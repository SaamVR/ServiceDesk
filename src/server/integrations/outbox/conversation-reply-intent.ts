import type { Result } from "../../../contracts";
import type { ClaimedOutboxEvent } from "../../../contracts/outbox";
import type { DeliveryChannel, OutboxJob, RecipientPolicy } from "../types";

export interface ConversationReplyRecipientPolicy extends RecipientPolicy {
  hardBounced?: boolean;
}

export interface ConversationReplyAuthoritativeSource {
  eventId: string;
  workspaceId: string;
  conversationId: string;
  messageId: string;
  senderKind: "CUSTOMER" | "STAFF" | "AI" | "SYSTEM";
  channel: Extract<DeliveryChannel, "WHATSAPP" | "EMAIL">;
  recipient: ConversationReplyRecipientPolicy;
  conversationVersion: number;
  handoverActive: boolean;
  body: string;
  lastInboundAt?: string;
  subject?: string;
  html?: string;
  text?: string;
}

export interface ConversationReplyAuthoritativeSourcePort {
  load(event: ClaimedOutboxEvent): Promise<Result<ConversationReplyAuthoritativeSource>>;
}

function stringPayload(event: ClaimedOutboxEvent, key: string): string | undefined {
  const value = event.payload[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function fail(code: string, message: string): Result<never> {
  return { ok: false, code, message };
}

function validateSource(event: ClaimedOutboxEvent, source: ConversationReplyAuthoritativeSource): Result<true> {
  if (event.topic !== "conversation.reply") return fail("OUTBOX_TOPIC_UNSUPPORTED", "Conversation reply resolver only accepts conversation.reply events.");
  if (source.eventId !== event.id) return fail("OUTBOX_EVENT_ID_MISMATCH", "Authoritative conversation reply source did not match claimed event id.");
  if (source.workspaceId !== event.workspaceId) return fail("WORKSPACE_MISMATCH", "Authoritative conversation reply workspace did not match claimed event workspace.");
  if (stringPayload(event, "conversationId") !== source.conversationId) return fail("CONVERSATION_ID_MISMATCH", "Claimed conversation id did not match authoritative source.");
  if (stringPayload(event, "messageId") !== source.messageId) return fail("MESSAGE_ID_MISMATCH", "Claimed message id did not match authoritative source.");
  if (source.senderKind !== "STAFF") return fail("SENDER_KIND_UNSUPPORTED", "Only authorized STAFF conversation replies may become provider dispatch intents.");
  if (source.channel !== "WHATSAPP" && source.channel !== "EMAIL") return fail("CHANNEL_UNSUPPORTED", "Conversation reply channel must be WHATSAPP or EMAIL.");
  if (!source.recipient.recipientRef.trim()) return fail("RECIPIENT_MISSING", "Authoritative conversation reply recipient is missing.");
  if (!source.body.trim()) return fail("REPLY_BODY_MISSING", "Authoritative conversation reply body is missing.");
  return { ok: true, value: true };
}

export function buildConversationReplyOutboxJob(event: ClaimedOutboxEvent, source: ConversationReplyAuthoritativeSource): Result<OutboxJob> {
  const valid = validateSource(event, source);
  if (!valid.ok) return valid;

  const basePayload = {
    conversationId: source.conversationId,
    messageId: source.messageId,
    senderKind: source.senderKind,
    body: source.body,
    lastInboundAt: source.lastInboundAt,
  };

  const payload: Record<string, unknown> = source.channel === "EMAIL"
    ? {
        ...basePayload,
        email: {
          to: source.recipient.recipientRef,
          subject: source.subject ?? "Reply from your service team",
          text: source.text ?? source.body,
          html: source.html ?? source.body,
          policy: {
            optedOut: source.recipient.optedOut,
            hardBounced: source.recipient.hardBounced,
            handoverOpen: false,
          },
        },
      }
    : basePayload;

  return {
    ok: true,
    value: {
      id: event.id,
      workspaceId: event.workspaceId,
      channel: source.channel,
      purpose: "CUSTOMER_REPLY",
      recipient: {
        recipientRef: source.recipient.recipientRef,
        consentRequired: source.recipient.consentRequired,
        hasOptIn: source.recipient.hasOptIn,
        optedOut: source.recipient.optedOut,
        quietHoursBlocked: source.recipient.quietHoursBlocked,
      },
      createdAt: event.claimedAt,
      idempotencyKey: event.idempotencyKey,
      handoverGuard: {
        conversationId: source.conversationId,
        expectedConversationVersion: source.conversationVersion,
        handoverActive: source.handoverActive,
      },
      freeformText: source.body,
      payload,
    },
  };
}

export async function resolveConversationReplyIntent(event: ClaimedOutboxEvent, sourcePort: ConversationReplyAuthoritativeSourcePort): Promise<Result<OutboxJob>> {
  const source = await sourcePort.load(event);
  if (!source.ok) return source;
  return buildConversationReplyOutboxJob(event, source.value);
}
