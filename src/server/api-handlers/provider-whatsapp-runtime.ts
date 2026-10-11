import type { ServiceDeskFacade } from "../core/facade";
import { handleWhatsAppStatusWebhook, type ProviderDeliveryStatusStore, type ProviderHandlerResult } from "./provider-whatsapp";
import { parseInboundMessages, verifyMetaSignature } from "../integrations/whatsapp/adapter";
import { buildDurableWhatsAppInboxRecord, rawWhatsAppProviderEventRef } from "../integrations/whatsapp/inbox-persistence";
import { toInboundMessageEvent } from "../integrations/whatsapp/inbound-core-handoff";
import { MAX_INBOUND_WEBHOOK_BYTES } from "./inbound-http-policy";

/**
 * Signed Meta callback -> existing atomic, idempotent conversation RPC.
 * Unlike the legacy handler, this does not store or echo the raw provider
 * payload, and it never acknowledges unsupported delivery-status callbacks.
 */
export interface WhatsAppRuntimeWebhookInput {
  rawBody: string;
  headers: Readonly<Record<string, string | undefined>>;
  appSecret: string;
  workspaceByPhoneNumberId: Readonly<Record<string, string>>;
  store: Pick<ServiceDeskFacade, "applyInboundMessage">;
  statusStore?: ProviderDeliveryStatusStore;
}

function result(statusCode: number, body: string, retryable = false): ProviderHandlerResult {
  return { statusCode, body, acknowledged: statusCode === 200, retryable };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function providerIds(payload: Record<string, unknown>): { ids: string[]; hasStatuses: boolean } | undefined {
  if (payload.object !== "whatsapp_business_account" || !Array.isArray(payload.entry)) return undefined;
  const ids: string[] = [];
  let hasStatuses = false;
  for (const entry of payload.entry) {
    if (!isRecord(entry) || !Array.isArray(entry.changes)) return undefined;
    for (const change of entry.changes) {
      if (!isRecord(change) || !isRecord(change.value)) return undefined;
      const metadata = change.value.metadata;
      if (!isRecord(metadata) || typeof metadata.phone_number_id !== "string" ||
          !metadata.phone_number_id.trim()) return undefined;
      ids.push(metadata.phone_number_id);
      // Never acknowledge a signed status payload that was not actually
      // understood. Meta would stop retrying and the Inbox would incorrectly
      // continue to display a stale delivered/read state.
      if ("statuses" in change.value) {
        if (!Array.isArray(change.value.statuses)) return undefined;
        for (const status of change.value.statuses) {
          if (!isRecord(status) ||
              typeof status.id !== "string" || !status.id.trim() ||
              typeof status.timestamp !== "string" ||
              !(status.timestamp.length > 0 && status.timestamp.length <= 13 &&
                [...status.timestamp].every(char => char >= "0" && char <= "9")) ||
              !["sent", "delivered", "read", "failed"].includes(String(status.status))) {
            return undefined;
          }
        }
        if (change.value.statuses.length > 0) hasStatuses = true;
      }
      if ("messages" in change.value && !Array.isArray(change.value.messages)) return undefined;
    }
  }
  return { ids, hasStatuses };
}

export async function handleWhatsAppRuntimeWebhook(input: WhatsAppRuntimeWebhookInput): Promise<ProviderHandlerResult> {
  if (!input.appSecret || !input.workspaceByPhoneNumberId) {
    return result(503, "WhatsApp inbound signing or tenant routing is not configured.", true);
  }
  if (Buffer.byteLength(input.rawBody, "utf8") > MAX_INBOUND_WEBHOOK_BYTES) {
    return result(413, "WhatsApp webhook exceeds the accepted payload limit.");
  }
  const signature = Object.entries(input.headers).find(([key]) =>
    key.toLowerCase() === "x-hub-signature-256")?.[1];
  if (!verifyMetaSignature(input.rawBody, signature, input.appSecret).ok) {
    return result(401, "WhatsApp webhook signature is missing or invalid.");
  }

  let payload: unknown;
  try { payload = JSON.parse(input.rawBody); } catch {
    return result(400, "WhatsApp webhook JSON is malformed.");
  }
  if (!isRecord(payload)) return result(400, "WhatsApp webhook payload must be a JSON object.");
  const envelope = providerIds(payload);
  if (!envelope) return result(400, "WhatsApp webhook envelope is invalid.");

  // Check every account before processing *any* tenant's message. A signed
  // callback for an unmapped number cannot be routed to an arbitrary tenant.
  if (envelope.ids.some(id => !Object.hasOwn(input.workspaceByPhoneNumberId, id) ||
      !input.workspaceByPhoneNumberId[id])) {
    return result(403, "WhatsApp webhook contains an unmapped business phone number.");
  }

  // Status callbacks need an actual status persistence port; without it,
  // requesting Meta retry is safer than falsely acknowledging delivery.
  if (envelope.hasStatuses) {
    if (!input.statusStore) return result(503, "WhatsApp delivery-status persistence is unavailable.", true);
    try {
      const status = await handleWhatsAppStatusWebhook({
        rawBody: input.rawBody,
        headers: { ...input.headers },
        appSecret: input.appSecret,
        workspaceByPhoneNumberId: { ...input.workspaceByPhoneNumberId },
        store: input.statusStore,
      });
      if (!status.acknowledged) {
        return result(status.statusCode >= 500 ? 503 : status.statusCode,
          "WhatsApp delivery-status callback could not be applied.", status.retryable);
      }
    } catch {
      return result(503, "WhatsApp delivery-status callback could not be applied.", true);
    }
  }

  const messages = parseInboundMessages(payload, { ...input.workspaceByPhoneNumberId });
  const summary = { received: messages.length, applied: 0, duplicate: 0, unsupported: 0 };
  for (const message of messages) {
    try {
      const rawRef = rawWhatsAppProviderEventRef({
        workspaceId: message.workspaceId, providerAccountId: message.phoneNumberId,
        rawBody: input.rawBody,
      });
      const record = buildDurableWhatsAppInboxRecord(message, rawRef);
      if (record.contentKind === "UNSUPPORTED") {
        summary.unsupported += 1;
        continue;
      }
      const outcome = await input.store.applyInboundMessage(toInboundMessageEvent(record));
      if (!outcome.ok) {
        return result(503, "WhatsApp inbound conversation persistence is unavailable.", true);
      }
      if (outcome.value.state === "APPLIED") summary.applied += 1;
      else if (outcome.value.state === "DUPLICATE") summary.duplicate += 1;
      else return result(503, "WhatsApp inbound conversation state is unrecognized.", true);
    } catch {
      // Never expose RPC exceptions, customer text, access tokens or receipt IDs
      // to Meta; retry replays are safe through the receiptKey unique constraint.
      return result(503, "WhatsApp inbound conversation persistence is unavailable.", true);
    }
  }
  return result(200, JSON.stringify(summary));
}
