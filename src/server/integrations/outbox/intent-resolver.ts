import type { ClaimedOutboxEvent } from "../../../contracts/outbox";
import type { Result } from "../../../contracts";
import type { DeliveryChannel, DeliveryPurpose, OutboxJob } from "../types";

export interface OutboxDeliveryIntentResolver {
  resolve(event: ClaimedOutboxEvent): Promise<Result<OutboxJob>>;
}

const channels = new Set<DeliveryChannel>(["WHATSAPP", "EMAIL", "WEBHOOK", "GOOGLE_CALENDAR"]);
const purposes = new Set<DeliveryPurpose>([
  "QUOTE", "CONFIRMATION", "REMINDER", "INVOICE", "FEEDBACK", "STAFF_ALERT",
  "CUSTOMER_REPLY", "CALENDAR_VISIT", "VISIT_REMINDER", "RETENTION_CAMPAIGN",
]);

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function identity(value: unknown, max = 256): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= max &&
    value.trim() === value &&
    !/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/u.test(value);
}

function failure(code: string, message: string): Result<OutboxJob> {
  return { ok: false, code, message };
}

/**
 * Check recovered, database-backed intent BEFORE opt-in logic or provider
 * dispatch. A resolver's TypeScript return type is not a runtime trust
 * boundary; malformed or cross-tenant source records must fail closed with
 * an explicit Result, not throw while dereferencing an absent recipient.
 */
export function validateResolvedOutboxJob(event: ClaimedOutboxEvent, job: OutboxJob): Result<OutboxJob> {
  if (!record(event) || !record(job) ||
      !identity(event.id) || !identity(event.workspaceId) || !identity(event.idempotencyKey) ||
      !identity(job.id) || !identity(job.workspaceId) || !identity(job.idempotencyKey)) {
    return failure("OUTBOX_INTENT_IDENTITY_INVALID", "Claimed and resolved outbox identity is incomplete.");
  }
  if (job.id !== event.id) return failure("OUTBOX_INTENT_ID_MISMATCH", "Resolved outbox job id does not match the claimed event id.");
  if (job.workspaceId !== event.workspaceId) return failure("OUTBOX_INTENT_WORKSPACE_MISMATCH", "Resolved outbox job workspace does not match the claimed event workspace.");
  if (job.idempotencyKey !== event.idempotencyKey) return failure("OUTBOX_INTENT_IDEMPOTENCY_MISMATCH", "Resolved outbox job idempotency key does not match the claimed event idempotency key.");
  if (!channels.has(job.channel)) return failure("OUTBOX_INTENT_CHANNEL_INVALID", "Resolved outbox delivery channel is unsupported.");
  if (!purposes.has(job.purpose)) return failure("OUTBOX_INTENT_PURPOSE_INVALID", "Resolved outbox delivery purpose is unsupported.");

  // Access no nested fields until the recipient object's shape has passed.
  if (!record(job.recipient) || (typeof job.recipient.recipientRef === "string" &&
      job.recipient.recipientRef.trim().length === 0)) {
    return failure("OUTBOX_INTENT_RECIPIENT_MISSING", "Resolved outbox job is missing a recipient.");
  }
  if (!identity(job.recipient.recipientRef) ||
      typeof job.recipient.consentRequired !== "boolean" ||
      typeof job.recipient.hasOptIn !== "boolean" ||
      typeof job.recipient.optedOut !== "boolean" ||
      (job.recipient.quietHoursBlocked !== undefined &&
       typeof job.recipient.quietHoursBlocked !== "boolean")) {
    return failure("OUTBOX_INTENT_RECIPIENT_INVALID", "Resolved outbox recipient policy is incomplete.");
  }
  if (!record(job.payload)) {
    return failure("OUTBOX_INTENT_PAYLOAD_INVALID", "Resolved outbox payload is not structured.");
  }
  if (job.handoverGuard !== undefined &&
      (!record(job.handoverGuard) || !identity(job.handoverGuard.conversationId) ||
       !Number.isSafeInteger(job.handoverGuard.expectedConversationVersion) ||
       job.handoverGuard.expectedConversationVersion < 0 ||
       typeof job.handoverGuard.handoverActive !== "boolean")) {
    return failure("OUTBOX_INTENT_HANDOVER_INVALID", "Resolved outbox handover evidence is incomplete.");
  }
  return { ok: true, value: job };
}
