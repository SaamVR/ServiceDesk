import type { EmailCallbackLifecycleEvent } from "./lifecycle";

export type EmailCallbackReceiptPersistenceResult = "INSERTED" | "DUPLICATE";

export interface EmailCallbackReceiptRow {
  callbackKey: string;
  providerMessageId: string;
  eventType: EmailCallbackLifecycleEvent["eventType"];
  bounceClass?: "hard" | "soft" | "unknown";
  occurredAt: string;
  redactedRecipientRef: string;
  processingState?: "PENDING" | "PROCESSED" | "FAILED";
  processingLink?: string;
}

export interface EmailCallbackReceiptGateway {
  insertReceipt(row: EmailCallbackReceiptRow): Promise<EmailCallbackReceiptPersistenceResult>;
}

export interface EmailCallbackReceiptStore {
  persist(event: EmailCallbackLifecycleEvent & { recipientRef: string }): Promise<EmailCallbackReceiptPersistenceResult>;
}

function nonblank(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function redactEmailRecipientRef(value: string): string {
  const trimmed = value.trim().toLowerCase();
  const at = trimmed.indexOf("@");
  if (at > 0) return `email:${trimmed.slice(0, 2)}…@${trimmed.slice(at + 1)}`;
  if (trimmed.length <= 4) return "recipient:redacted";
  return `recipient:${trimmed.slice(0, 2)}…${trimmed.slice(-2)}`;
}

export function toEmailCallbackReceiptRow(
  event: EmailCallbackLifecycleEvent & { recipientRef: string },
  processingState: EmailCallbackReceiptRow["processingState"] = "PENDING",
): EmailCallbackReceiptRow {
  if (!nonblank(event.callbackKey) || !nonblank(event.providerMessageId) || !nonblank(event.occurredAt)) {
    throw new Error("EMAIL_CALLBACK_RECEIPT_IDENTITY_INVALID");
  }
  const occurredAtMs = new Date(event.occurredAt).getTime();
  if (!Number.isFinite(occurredAtMs)) {
    throw new Error("EMAIL_CALLBACK_RECEIPT_TIMESTAMP_INVALID");
  }

  return {
    callbackKey: event.callbackKey,
    providerMessageId: event.providerMessageId,
    eventType: event.eventType,
    bounceClass: event.bounceType,
    occurredAt: new Date(occurredAtMs).toISOString(),
    redactedRecipientRef: redactEmailRecipientRef(event.recipientRef),
    processingState,
    processingLink: `email-callback:${event.providerMessageId}:${event.callbackKey}`,
  };
}

export function createEmailCallbackReceiptStore(gateway: EmailCallbackReceiptGateway): EmailCallbackReceiptStore {
  return {
    async persist(event) {
      return gateway.insertReceipt(toEmailCallbackReceiptRow(event));
    },
  };
}
