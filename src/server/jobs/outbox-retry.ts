import type { ClaimedOutboxEvent, OutboxExecutionOutcome, Result } from "../../contracts";
import { trustedQuoteInstant } from "../../features/operations/quote-validity-clock";

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

function parseTime(iso: unknown): number | undefined {
  // Provider clocks must be civil-valid and explicit about their timezone.
  // A normalizing Date.parse is insufficient to certify SENT or schedule
  // a retry from an otherwise nonexistent day.
  return trustedQuoteInstant(iso) ?? undefined;
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
  if (!input || !input.event || !input.outcome ||
      typeof input.event.id !== "string" ||
      !/^[A-Za-z0-9:_-]{1,128}$/.test(input.event.id)) {
    return {ok:false,code:"OUTBOX_EVENT_INVALID",
      message:"Claimed outbox event identity and outcome are required."};
  }
  const baseDelaySeconds = input.baseDelaySeconds ?? 60;
  const maxDelaySeconds = input.maxDelaySeconds ?? 3_600;
  if (!Number.isSafeInteger(input.event.attempt) || input.event.attempt < 1) {
    return { ok: false, code: "OUTBOX_ATTEMPT_INVALID", message: "Claimed outbox attempt must be a positive integer." };
  }
  if (!Number.isSafeInteger(input.maxAttempts) || input.maxAttempts < 1) {
    return { ok: false, code: "OUTBOX_MAX_ATTEMPTS_INVALID", message: "Outbox maxAttempts must be a positive integer." };
  }
  if (!Number.isSafeInteger(baseDelaySeconds) || baseDelaySeconds < 1 ||
      !Number.isSafeInteger(maxDelaySeconds) || maxDelaySeconds < baseDelaySeconds ||
      maxDelaySeconds > 604_800) {
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

  // An executor/transport is an untrusted authority boundary even if its
  // TypeScript declaration is a tagged union. Unknown tags used to fall
  // through to RETRYABLE_FAILURE and arbitrary provider error strings used to
  // flow into durable outbox rows and the worker's diagnostic summaries.
  if (!["SENT", "RETRYABLE_FAILURE", "TERMINAL_FAILURE", "SUPPRESSED"]
      .includes(outcome.outcome)) {
    return { ok: false, code: "OUTBOX_OUTCOME_INVALID",
      message: "Executor returned an unknown outbox outcome." };
  }
  if (outcome.outcome !== "SENT" &&
      (typeof outcome.code !== "string" ||
       !/^[A-Z][A-Z0-9_]{0,95}$/.test(outcome.code))) {
    return { ok: false, code: "OUTBOX_FAILURE_CODE_INVALID",
      message: "Provider failures require a bounded, redacted machine code." };
  }

  if (outcome.outcome === "SENT") {
    // Never persist an arbitrary provider response into a durable SENT
    // receipt. Opaque WhatsApp/Stripe-style IDs are fine; customer contacts,
    // URLs, bearer prefixes and unbounded payloads are not provider IDs.
    if (outcome.providerReference !== undefined &&
        (typeof outcome.providerReference !== "string" ||
         !/^[A-Za-z0-9._:+-]{1,256}$/.test(outcome.providerReference) ||
         /^(?:sk-|rk_|pk_|bearer)/i.test(outcome.providerReference))) {
      return {ok:false,code:"OUTBOX_PROVIDER_REFERENCE_INVALID",
        message:"Provider reference must be a bounded opaque identifier."};
    }
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
  if (!Number.isFinite(retryAfter) || !Number.isInteger(retryAfter) || retryAfter < 0) {
    return { ok: false, code: "OUTBOX_RETRY_AFTER_INVALID", message: "retryAfterSeconds must be a nonnegative integer when provided." };
  }
  // Preserve the R39 worker contract: a syntactically integral but unsafe
  // provider delay is a schedule overflow, never a durable retry timestamp.
  if (!Number.isSafeInteger(retryAfter)) {
    return { ok: false, code: "OUTBOX_RETRY_SCHEDULE_INVALID",
      message: "Provider retry schedule exceeds supported timestamp range." };
  }
  const delaySeconds = Math.max(minimum, retryAfter);
  // A provider Retry-After can be a syntactically valid integer but still
  // overflow Date's supported range. Keep the worker's batch alive and fail
  // the affected record closed instead of throwing RangeError from toISOString.
  const nextAttemptMs = (parseTime(outcome.failedAt) ?? NaN) + delaySeconds * 1_000;
  if (!Number.isFinite(nextAttemptMs) || Math.abs(nextAttemptMs) > 8.64e15) {
    return { ok: false, code: "OUTBOX_RETRY_SCHEDULE_INVALID", message: "Provider retry schedule exceeds supported timestamp range." };
  }
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
