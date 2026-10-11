import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProviderDeliveryStatusStore, WhatsAppStatusCallbackInput, ProviderDeliveryStatusApplyResult } from "../../api-handlers/provider-whatsapp";
import { normalizeProviderTimestampToIso } from "./timestamp-normalization";

type DeliveryState = WhatsAppStatusCallbackInput["deliveryState"];
type PersistedState = DeliveryState | "QUEUED" | "RUNNING" | "SUPPRESSED";
export interface WhatsAppOutboundReceipt {
  id: string;
  workspace_id: string;
  topic: string;
  status: string;
  provider_reference: string | null;
  payload: unknown;
}
export interface WhatsAppOutboundMessage {
  id: string;
  workspace_id: string;
  outbox_event_id: string | null;
  direction: string;
  sender_kind: string;
  delivery_state: string | null;
  provider_occurred_at: string | null;
}
export interface WhatsAppStatusUpdate {
  messageId: string;
  workspaceId: string;
  previousStates: readonly PersistedState[];
  deliveryState: DeliveryState;
  providerMessageId: string;
  providerAccountId: string;
  providerOccurredAt: string;
}
export interface WhatsAppStatusPersistencePort {
  findReceipts(workspaceId: string, providerMessageId: string): Promise<WhatsAppOutboundReceipt[]>;
  findMessages(workspaceId: string, eventId: string): Promise<WhatsAppOutboundMessage[]>;
  updateIfCurrent(input: WhatsAppStatusUpdate): Promise<WhatsAppOutboundMessage[]>;
}

/** PostgreSQL conditional UPDATE is the linearization point, not a process-local mutex. */
export function createSupabaseWhatsAppStatusPersistence(client: SupabaseClient): WhatsAppStatusPersistencePort {
  return {
    async findReceipts(workspaceId, providerMessageId) {
      const result = await client.from("outbox_events")
        .select("id,workspace_id,topic,status,provider_reference,payload")
        .eq("workspace_id", workspaceId)
        .eq("provider_reference", providerMessageId)
        .eq("status", "SENT").limit(2);
      if (result.error) throw new Error("WHATSAPP_STATUS_RECEIPT_READ_FAILED");
      return (result.data ?? []) as WhatsAppOutboundReceipt[];
    },
    async findMessages(workspaceId, eventId) {
      const result = await client.from("messages")
        .select("id,workspace_id,outbox_event_id,direction,sender_kind,delivery_state,provider_occurred_at")
        .eq("workspace_id", workspaceId)
        .eq("outbox_event_id", eventId)
        .eq("direction", "OUTBOUND").limit(2);
      if (result.error) throw new Error("WHATSAPP_STATUS_MESSAGE_READ_FAILED");
      return (result.data ?? []) as WhatsAppOutboundMessage[];
    },
    async updateIfCurrent(input) {
      // The old state and monotonic timestamp predicates are evaluated by
      // PostgreSQL in one UPDATE. A delayed "delivered" cannot overwrite READ.
      const result = await client.from("messages")
        .update({
          delivery_state: input.deliveryState,
          provider_message_id: input.providerMessageId,
          provider_account_id: input.providerAccountId,
          provider_occurred_at: input.providerOccurredAt,
        })
        .eq("id", input.messageId)
        .eq("workspace_id", input.workspaceId)
        .eq("direction", "OUTBOUND")
        .in("delivery_state", [...input.previousStates])
        .or(`provider_occurred_at.is.null,provider_occurred_at.lte.${input.providerOccurredAt}`)
        .select("id,workspace_id,outbox_event_id,direction,sender_kind,delivery_state,provider_occurred_at");
      if (result.error) throw new Error("WHATSAPP_STATUS_CONDITIONAL_WRITE_FAILED");
      return (result.data ?? []) as WhatsAppOutboundMessage[];
    },
  };
}

const allowedPredecessors: Record<DeliveryState, readonly PersistedState[]> = {
  PROVIDER_ACCEPTED: ["QUEUED", "RUNNING"],
  DELIVERED: ["QUEUED", "RUNNING", "PROVIDER_ACCEPTED"],
  READ: ["QUEUED", "RUNNING", "PROVIDER_ACCEPTED", "DELIVERED"],
  FAILED: ["QUEUED", "RUNNING", "PROVIDER_ACCEPTED"],
};
const finalStates = new Set<PersistedState>([
  "QUEUED", "RUNNING", "PROVIDER_ACCEPTED", "DELIVERED", "READ", "FAILED", "SUPPRESSED",
]);
const safeDigits = (v: string) => v.replace(/[^0-9]/g, "");

function validatedState(row: WhatsAppOutboundMessage, workspace: string, outboxId: string): PersistedState {
  if (row.workspace_id !== workspace || row.outbox_event_id !== outboxId ||
      !row.id || row.direction !== "OUTBOUND" || row.sender_kind !== "STAFF" ||
      !finalStates.has(row.delivery_state as PersistedState)) {
    throw new Error("WHATSAPP_STATUS_OUTBOUND_SCOPE_INVALID");
  }
  return row.delivery_state as PersistedState;
}

function verifyReceipt(row: WhatsAppOutboundReceipt, event: WhatsAppStatusCallbackInput): void {
  const payload = row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
    ? row.payload as Record<string, unknown> : undefined;
  if (row.workspace_id !== event.workspaceId || !row.id ||
      row.status !== "SENT" || row.topic !== "conversation.reply" ||
      row.provider_reference !== event.providerMessageId ||
      payload?.channel !== "WHATSAPP" || typeof payload.recipient !== "string" ||
      !event.recipientId || !safeDigits(event.recipientId) ||
      safeDigits(payload.recipient) !== safeDigits(event.recipientId)) {
    throw new Error("WHATSAPP_STATUS_OUTBOX_IDENTITY_UNVERIFIED");
  }
}

function currentOutcome(row: WhatsAppOutboundMessage, event: WhatsAppStatusCallbackInput, outboxId: string): ProviderDeliveryStatusApplyResult {
  const state = validatedState(row, event.workspaceId, outboxId);
  if (state === event.deliveryState) return "DUPLICATE";
  return "STALE_REGRESSION";
}

/**
 * A status callback is *never* accepted only because it has a valid Meta HMAC.
 * It must link exactly one SENT WhatsApp outbox receipt and exactly one
 * tenant-scoped staff message. No matched receipt => retry, not false 200.
 * This port does not pretend to provide an independent callback-audit ledger;
 * business truth is the monotonic, conditionally updated message row.
 */
export function createPostgresWhatsAppDeliveryStatusStore(
  db: WhatsAppStatusPersistencePort,
): ProviderDeliveryStatusStore {
  return {
    async applyStatusCallback(event): Promise<ProviderDeliveryStatusApplyResult> {
      if (event.provider !== "WHATSAPP" || event.workspaceId.trim() === "" ||
          event.providerAccountId.trim() === "" || event.phoneNumberId !== event.providerAccountId ||
          !event.providerMessageId?.trim() || !event.callbackKey?.trim() ||
          !event.recipientId?.trim() || !finalStates.has(event.deliveryState) ||
          !allowedPredecessors[event.deliveryState]) {
        throw new Error("WHATSAPP_STATUS_CALLBACK_INVALID");
      }
      let timestamp: string;
      try { timestamp = normalizeProviderTimestampToIso(event.providerTimestamp); }
      catch { throw new Error("WHATSAPP_STATUS_TIMESTAMP_INVALID"); }
      const receipts = await db.findReceipts(event.workspaceId, event.providerMessageId);
      if (receipts.length !== 1) throw new Error("WHATSAPP_STATUS_OUTBOX_RECEIPT_AMBIGUOUS_OR_MISSING");
      const outbox = receipts[0];
      verifyReceipt(outbox, event);
      const messages = await db.findMessages(event.workspaceId, outbox.id);
      if (messages.length !== 1) throw new Error("WHATSAPP_STATUS_OUTBOUND_MESSAGE_AMBIGUOUS_OR_MISSING");
      const message = messages[0];
      const current = validatedState(message, event.workspaceId, outbox.id);
      const previousAt = message.provider_occurred_at ? Date.parse(message.provider_occurred_at) : NaN;
      if (Number.isFinite(previousAt) && Date.parse(timestamp) < previousAt) return "STALE_REGRESSION";
      if (current === event.deliveryState) return "DUPLICATE";
      const predecessors = allowedPredecessors[event.deliveryState];
      if (!predecessors.includes(current)) return "STALE_REGRESSION";

      const changed = await db.updateIfCurrent({
        messageId: message.id, workspaceId: event.workspaceId,
        previousStates: predecessors, deliveryState: event.deliveryState,
        providerAccountId: event.providerAccountId,
        providerMessageId: event.providerMessageId, providerOccurredAt: timestamp,
      });
      if (changed.length === 1) {
        if (changed[0].id !== message.id ||
            validatedState(changed[0], event.workspaceId, outbox.id) !== event.deliveryState) {
          throw new Error("WHATSAPP_STATUS_UPDATED_MESSAGE_INVALID");
        }
        return "APPLIED";
      }
      if (changed.length > 1) throw new Error("WHATSAPP_STATUS_MULTIPLE_ROWS_UPDATED");
      // Concurrent callbacks may have won the compare-and-set. Re-read to
      // classify duplicates/stale, but retry on a missing or still-pending row.
      const latest = await db.findMessages(event.workspaceId, outbox.id);
      if (latest.length !== 1) throw new Error("WHATSAPP_STATUS_CONCURRENT_READ_MISSING");
      const newState = validatedState(latest[0], event.workspaceId, outbox.id);
      if (newState === current &&
          (!latest[0].provider_occurred_at || latest[0].provider_occurred_at === message.provider_occurred_at)) {
        throw new Error("WHATSAPP_STATUS_CONDITIONAL_UPDATE_UNRESOLVED");
      }
      return currentOutcome(latest[0], event, outbox.id);
    },
  };
}
