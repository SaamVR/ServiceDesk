import type { ClaimedOutboxEvent } from "../../../contracts/outbox";
import type { Result } from "../../../contracts";
import type { OutboxJob } from "../types";

export interface OutboxDeliveryIntentResolver {
  resolve(event: ClaimedOutboxEvent): Promise<Result<OutboxJob>>;
}

function nonblank(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function failure(code: string, message: string): Result<OutboxJob> {
  return { ok: false, code, message };
}

export function validateResolvedOutboxJob(event: ClaimedOutboxEvent, job: OutboxJob): Result<OutboxJob> {
  if (job.id !== event.id) return failure("OUTBOX_INTENT_ID_MISMATCH", "Resolved outbox job id does not match the claimed event id.");
  if (job.workspaceId !== event.workspaceId) return failure("OUTBOX_INTENT_WORKSPACE_MISMATCH", "Resolved outbox job workspace does not match the claimed event workspace.");
  if (job.idempotencyKey !== event.idempotencyKey) return failure("OUTBOX_INTENT_IDEMPOTENCY_MISMATCH", "Resolved outbox job idempotency key does not match the claimed event idempotency key.");
  if (!nonblank(job.channel)) return failure("OUTBOX_INTENT_CHANNEL_MISSING", "Resolved outbox job is missing a delivery channel.");
  if (!nonblank(job.purpose)) return failure("OUTBOX_INTENT_PURPOSE_MISSING", "Resolved outbox job is missing a delivery purpose.");
  if (!nonblank(job.recipient?.recipientRef)) return failure("OUTBOX_INTENT_RECIPIENT_MISSING", "Resolved outbox job is missing a nonblank recipient reference.");
  return { ok: true, value: job };
}
