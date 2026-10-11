import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClaimedOutboxEvent, Result } from "../../../contracts";
import { buildConversationReplyOutboxJob } from "./conversation-reply-intent";
import type { OutboxDeliveryIntentResolver } from "./intent-resolver";

type Row = Record<string, unknown>;
type TablePort = Pick<SupabaseClient, "from">;
const fail = (code: string): Result<never> => ({
  ok: false, code, message: "Authoritative conversation reply could not be dispatched.",
});
function text(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 4000;
}
function row(value: unknown): Row | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Row : undefined;
}
const suppressed = (reason: string) => fail("OUTBOX_SUPPRESSED:" + reason);

/**
 * Reconstructs a queued STAFF message from the transactional outbox record
 * rather than trusting its denormalized JSON payload. The *deployed* reply RPC
 * writes conversationId/channel/recipient, but no messageId. Binding by
 * messages.outbox_event_id is both unique and tenant scoped.
 *
 * Every delivery rechecks latest customer consent, selected contact, and most
 * recent inbound message, preventing revocation and changed recipient sends.
 * When source reads fail, retry (never silently infer consent).
 */
export function createPostgresConversationReplyIntentResolver(
  client: TablePort,
): OutboxDeliveryIntentResolver {
  return {
    async resolve(event: ClaimedOutboxEvent) {
      if (event.topic !== "conversation.reply" || !text(event.id) ||
          !text(event.workspaceId) || !text(event.idempotencyKey)) {
        return fail("OUTBOX_REPLY_CLAIM_INVALID");
      }
      try {
        const o = await client.from("outbox_events")
          .select("id,workspace_id,topic,payload,status,idempotency_key")
          .eq("id", event.id).eq("workspace_id", event.workspaceId)
          .eq("topic", "conversation.reply").maybeSingle();
        if (o.error || !row(o.data)) return fail("OUTBOX_REPLY_EVENT_UNAVAILABLE");
        const outbox = o.data as Row;
        const payload = row(outbox.payload);
        if (outbox.id !== event.id || outbox.workspace_id !== event.workspaceId ||
            outbox.topic !== event.topic || outbox.idempotency_key !== event.idempotencyKey ||
            outbox.status !== "PENDING" || !payload ||
            !text(payload.conversationId) ||
            !["WHATSAPP", "EMAIL"].includes(String(payload.channel)) ||
            !text(payload.recipient) ||
            payload.conversationId !== event.payload.conversationId ||
            payload.channel !== event.payload.channel ||
            payload.recipient !== event.payload.recipient) {
          return fail("OUTBOX_REPLY_EVENT_MISMATCH");
        }
        const m = await client.from("messages")
          .select("id,workspace_id,conversation_id,direction,sender_kind,body,outbox_event_id,outbound_idempotency_key,created_at")
          .eq("workspace_id", event.workspaceId)
          .eq("outbox_event_id", event.id)
          .eq("direction", "OUTBOUND").limit(2);
        if (m.error || !Array.isArray(m.data)) return fail("OUTBOX_REPLY_MESSAGE_READ_FAILED");
        if (m.data.length !== 1) return fail("OUTBOX_REPLY_MESSAGE_AMBIGUOUS");
        const message = row(m.data[0]);
        if (!message || !text(message.id) ||
            message.workspace_id !== event.workspaceId ||
            message.outbox_event_id !== event.id ||
            message.conversation_id !== payload.conversationId ||
            message.sender_kind !== "STAFF" || message.direction !== "OUTBOUND" ||
            !text(message.body) || !text(message.outbound_idempotency_key) ||
            !text(message.created_at) || !Number.isFinite(Date.parse(message.created_at)) ||
            event.idempotencyKey !==
              `conversation.reply:${event.workspaceId}:${message.outbound_idempotency_key}` ||
            (text(event.payload.messageId) && message.id !== event.payload.messageId) ||
            (text(payload.body) && message.body !== payload.body)) {
          return fail("OUTBOX_REPLY_MESSAGE_MISMATCH");
        }
        const c = await client.from("conversations")
          .select("id,workspace_id,customer_id,channel,version,handover_active")
          .eq("workspace_id", event.workspaceId).eq("id", payload.conversationId)
          .maybeSingle();
        if (c.error || !row(c.data)) return fail("OUTBOX_REPLY_CONVERSATION_READ_FAILED");
        const conv = c.data as Row;
        if (conv.workspace_id !== event.workspaceId || conv.id !== payload.conversationId ||
            conv.channel !== payload.channel || !text(conv.customer_id) ||
            !Number.isSafeInteger(conv.version) || Number(conv.version) < 1 ||
            typeof conv.handover_active !== "boolean") {
          return fail("OUTBOX_REPLY_CONVERSATION_MISMATCH");
        }

        const kind = conv.channel === "WHATSAPP" ? "PHONE" : "EMAIL";
        const contact = await client.from("customer_contacts")
          .select("id,workspace_id,customer_id,kind,value,verified_at")
          .eq("workspace_id", event.workspaceId).eq("customer_id", String(conv.customer_id))
          .eq("kind", kind).order("is_primary", { ascending: false })
          .order("created_at", { ascending: true }).limit(1).maybeSingle();
        if (contact.error || !row(contact.data)) {
          return fail("OUTBOX_REPLY_CONTACT_UNAVAILABLE");
        }
        const recipient = contact.data as Row;
        if (recipient.workspace_id !== event.workspaceId ||
            recipient.customer_id !== conv.customer_id ||
            recipient.kind !== kind || !text(recipient.value)) {
          return fail("OUTBOX_REPLY_CONTACT_INVALID");
        }
        if (recipient.value !== payload.recipient) {
          return suppressed("RECIPIENT_CHANGED");
        }

        const consent = await client.from("communication_consents")
          .select("workspace_id,customer_id,channel,status,recorded_at")
          .eq("workspace_id", event.workspaceId)
          .eq("customer_id", String(conv.customer_id))
          .eq("channel", String(conv.channel))
          .order("recorded_at", { ascending: false })
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (consent.error) return fail("OUTBOX_REPLY_CONSENT_READ_FAILED");
        const approval = row(consent.data);
        if (!approval || approval.workspace_id !== event.workspaceId ||
            approval.customer_id !== conv.customer_id ||
            approval.channel !== conv.channel || approval.status !== "GRANTED") {
          return suppressed("CONSENT_NOT_GRANTED");
        }
        const inbound = await client.from("messages")
          .select("id,workspace_id,conversation_id,direction,sender_kind,created_at")
          .eq("workspace_id", event.workspaceId)
          .eq("conversation_id", String(conv.id))
          .eq("direction", "INBOUND").eq("sender_kind", "CUSTOMER")
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (inbound.error) return fail("OUTBOX_REPLY_INBOUND_READ_FAILED");
        const latestInbound = row(inbound.data);
        let lastInboundAt: string | undefined;
        if (latestInbound) {
          if (latestInbound.workspace_id !== event.workspaceId ||
              latestInbound.conversation_id !== conv.id ||
              latestInbound.direction !== "INBOUND" ||
              latestInbound.sender_kind !== "CUSTOMER" ||
              !text(latestInbound.created_at) ||
              !Number.isFinite(Date.parse(latestInbound.created_at))) {
            return fail("OUTBOX_REPLY_INBOUND_INVALID");
          }
          lastInboundAt = latestInbound.created_at as string;
          if (text(message.created_at) && Number.isFinite(Date.parse(message.created_at)) &&
              Date.parse(lastInboundAt) > Date.parse(message.created_at)) {
            return suppressed("NEWER_CUSTOMER_MESSAGE");
          }
        }

        return buildConversationReplyOutboxJob(event, {
          eventId: event.id, workspaceId: event.workspaceId,
          conversationId: String(conv.id), messageId: String(message.id),
          senderKind: "STAFF", channel: conv.channel as "WHATSAPP" | "EMAIL",
          recipient: { recipientRef: String(recipient.value), consentRequired: true,
            hasOptIn: true, optedOut: false },
          conversationVersion: conv.version as number,
          handoverActive: Boolean(conv.handover_active),
          body: String(message.body),
          lastInboundAt,
        });
      } catch {
        return fail("OUTBOX_REPLY_SOURCE_UNAVAILABLE");
      }
    },
  };
}
