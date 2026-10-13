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
  // The callback is signed, but provider recipient references can still
  // contain arbitrary supplied bytes. Keep diagnostics single-line,
  // visibly redacted, and free from spoofed Unicode direction controls.
  if (typeof value !== "string" || value.length > 512 ||
      /[\x00-\x1f\x7f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/iu.test(value)) {
    return "recipient:redacted";
  }
  const trimmed = value.trim().toLowerCase();
  const email = /^([a-z0-9._%+-]+)@([a-z0-9.-]+\.[a-z]{2,63})$/.exec(trimmed);
  if (email) return `email:${email[1].slice(0, 2)}…@${email[2]}`;
  if (!/^[a-z0-9:_-]{5,128}$/.test(trimmed)) return "recipient:redacted";
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
