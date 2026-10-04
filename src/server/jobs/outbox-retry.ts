import type { ClaimedOutboxEvent, OutboxExecutionOutcome, Result } from "../../contracts";

export type OutboxPersistenceDecision =
  | { action: "markSent"; eventId: string; completedAt: string; providerReference?: string }
  | { action: "markRetry"; eventId: string; failedAt: string; nextAttemptAt: string; nextAttemptCount: number; errorCode: string }
  | { action: "markFailed"; eventId: string; failedAt: string; attempts: number; errorCode: string }
  | { action: "markSuppressed"; eventId: string; failedAt: string; attempts: number; code: string };

export interface OutboxRetryPolicyInput {
  event: Pick<ClaimedOutboxEvent, "id" | "attempt">;
  outcome: OutboxExecutionOutcome;
  maxAttempts: number;
  baseDelaySeconds?: number;
  maxDelaySeconds?: number;
}

function parseTime(iso: string): number | undefined {
  const time = new Date(iso).getTime();
  return Number.isFinite(time) ? time : undefined;
}

function addSeconds(iso: string, seconds: number): string {
  return new Date(new Date(iso).getTime() + seconds * 1000).toISOString();
}

function validatePolicy(input: OutboxRetryPolicyInput): Result<{
  attempt: number;
  maxAttempts: number;
  baseDelaySeconds: number;
  maxDelaySeconds: number;
}> {
  const baseDelaySeconds = input.baseDelaySeconds ?? 60;
  const maxDelaySeconds = input.maxDelaySeconds ?? 3_600;
  if (!Number.isInteger(input.event.attempt) || input.event.attempt < 1) {
    return { ok: false, code: "OUTBOX_ATTEMPT_INVALID", message: "Claimed outbox attempt must be a positive integer." };
  }
  if (!Number.isInteger(input.maxAttempts) || input.maxAttempts < 1) {
    return { ok: false, code: "OUTBOX_MAX_ATTEMPTS_INVALID", message: "Outbox maxAttempts must be a positive integer." };
  }
  if (!Number.isInteger(baseDelaySeconds) || baseDelaySeconds < 1 || !Number.isInteger(maxDelaySeconds) || maxDelaySeconds < baseDelaySeconds) {
    return { ok: false, code: "OUTBOX_RETRY_CONFIG_INVALID", message: "Outbox retry delays must be positive integers and max must be >= base." };
  }
  return { ok: true, value: { attempt: input.event.attempt, maxAttempts: input.maxAttempts, baseDelaySeconds, maxDelaySeconds } };
}

export function minimumBackoffSeconds(attempt: number, baseDelaySeconds = 60, maxDelaySeconds = 3_600): number {
  return Math.min(maxDelaySeconds, baseDelaySeconds * (2 ** Math.max(0, attempt - 1)));
}

export function decideOutboxPersistence(input: OutboxRetryPolicyInput): Result<OutboxPersistenceDecision> {
  const policy = validatePolicy(input);
  if (policy.ok === false) return policy;

  const { attempt, maxAttempts, baseDelaySeconds, maxDelaySeconds } = policy.value;
  const { outcome } = input;

  if (outcome.outcome === "SENT") {
    if (parseTime(outcome.completedAt) === undefined) return { ok: false, code: "OUTBOX_COMPLETED_AT_INVALID", message: "SENT outcome requires a valid completedAt timestamp." };
    return { ok: true, value: { action: "markSent", eventId: input.event.id, completedAt: outcome.completedAt, providerReference: outcome.providerReference } };
  }

  if (outcome.outcome === "TERMINAL_FAILURE") {
    if (parseTime(outcome.failedAt) === undefined) return { ok: false, code: "OUTBOX_FAILED_AT_INVALID", message: "Terminal failure requires a valid failedAt timestamp." };
    return { ok: true, value: { action: "markFailed", eventId: input.event.id, failedAt: outcome.failedAt, attempts: attempt, errorCode: outcome.code } };
  }

  if (outcome.outcome === "SUPPRESSED") {
    if (parseTime(outcome.failedAt) === undefined) return { ok: false, code: "OUTBOX_FAILED_AT_INVALID", message: "Suppressed outcome requires a valid failedAt timestamp." };
    return { ok: true, value: { action: "markSuppressed", eventId: input.event.id, failedAt: outcome.failedAt, attempts: attempt, code: outcome.code } };
  }

  if (parseTime(outcome.failedAt) === undefined) return { ok: false, code: "OUTBOX_FAILED_AT_INVALID", message: "Retryable failure requires a valid failedAt timestamp." };
  if (attempt >= maxAttempts) {
    return { ok: true, value: { action: "markFailed", eventId: input.event.id, failedAt: outcome.failedAt, attempts: attempt, errorCode: outcome.code } };
  }

  const minimum = minimumBackoffSeconds(attempt, baseDelaySeconds, maxDelaySeconds);
  const retryAfter = outcome.retryAfterSeconds ?? 0;
  if (!Number.isInteger(retryAfter) || retryAfter < 0) {
    return { ok: false, code: "OUTBOX_RETRY_AFTER_INVALID", message: "retryAfterSeconds must be a nonnegative integer when provided." };
  }
  const delaySeconds = Math.max(minimum, retryAfter);
  return {
    ok: true,
    value: {
      action: "markRetry",
      eventId: input.event.id,
      failedAt: outcome.failedAt,
      nextAttemptAt: addSeconds(outcome.failedAt, delaySeconds),
      nextAttemptCount: attempt,
      errorCode: outcome.code,
    },
  };
}
