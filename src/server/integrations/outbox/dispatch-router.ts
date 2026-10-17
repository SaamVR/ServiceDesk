import type { Result } from "../../../contracts";
import { hasRecipientSuppression, type DeliveryChannel } from "../types";
import { classifyProviderFailure } from "./failure-policy";
import { dispatchOutcomeBase, type CommittedOutboxDispatcher, type CommittedOutboxDispatchInput, type CommittedOutboxDispatchOutcome } from "./dispatch-port";

/** PostgreSQL timestamptz can serialize microseconds. Preserve all six
 * digits for ordering; Date.parse alone truncates below one millisecond and
 * can silently normalize impossible civil dates.
 */
function utcMicros(value: unknown): bigint | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?Z$/.exec(value);
  if (!match) return null;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return null;
  const fraction = (match[2] ?? "").padEnd(6, "0");
  const canonical = match[1] + "." + fraction.slice(0, 3) + "Z";
  if (parsed.toISOString() !== canonical) return null;
  return BigInt(parsed.getTime()) * 1000n + BigInt(fraction.slice(3, 6));
}

/** Provider 2xx is not delivery, but even its acceptance receipt must be
 * coherent before the durable outbox transitions to ACCEPTED.
 */
function validAcceptedReceipt(value: Record<string, unknown>, committedAt: string): boolean {
  const id = value.providerMessageId;
  const mode = value.providerMode;
  const evidence = value.evidence;
  if (typeof id !== "string" || !/^[\x21-\x7e]{1,512}$/.test(id) ||
      !["FIXTURE", "SANDBOX", "LIVE"].includes(String(mode)) ||
      !evidence || typeof evidence !== "object" || Array.isArray(evidence)) return false;
  const details = evidence as Record<string, unknown>;
  // Parse all values with civil-day validation before comparing them. A
  // provider acceptance even 1 microsecond older than a claim is not proof.
  const accepted = utcMicros(value.acceptedAt);
  const captured = utcMicros(details.capturedAt);
  const claimed = utcMicros(committedAt);
  if (accepted === null || captured === null || claimed === null) return false;
  // A contract test receipt must never masquerade as LIVE delivery evidence.
  // Provider acceptance and redacted capture must remain within a bounded
  // claim window, rather than fabricating timestamps days or years ahead.
  const liveVerified = mode !== "LIVE" || details.verification === "PROVIDER_VERIFIED";
  const maxProofAgeMicros = 24n * 60n * 60n * 1_000_000n;
  const allowedWallClock = BigInt(Date.now() + 5 * 60 * 1000) * 1000n;
  return details.mode === mode && details.provider === value.channel &&
    ["CONTRACT_TESTED", "PROVIDER_VERIFIED"].includes(String(details.verification)) &&
    liveVerified &&
    accepted >= claimed && captured >= accepted &&
    captured - claimed <= maxProofAgeMicros &&
    // Provider clocks can drift briefly; dates from tomorrow cannot prove
    // a receipt was accepted by an external service today.
    accepted <= allowedWallClock && captured <= allowedWallClock;
}

// Direct dispatch is an authorization boundary even if a resolver normally
// checked the saved job earlier. A lease recovery or custom worker can call it
// without that resolver; do not turn object-coerced IDs or invalid intent
// enums into a provider invocation.
const committedIdentity = (value: unknown, max = 256): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= max &&
  value.trim() === value &&
  !/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/u.test(value);
const dispatchChannels = new Set<string>(["WHATSAPP", "EMAIL", "WEBHOOK", "GOOGLE_CALENDAR"]);
const dispatchPurposes = new Set<string>([
  "QUOTE", "CONFIRMATION", "REMINDER", "INVOICE", "FEEDBACK", "STAFF_ALERT",
  "CUSTOMER_REPLY", "CALENDAR_VISIT", "VISIT_REMINDER", "RETENTION_CAMPAIGN",
]);

export type DispatchRouterTable = Partial<Record<DeliveryChannel, CommittedOutboxDispatcher>>;

export interface DispatchCommittedOutboxJobInput extends Omit<CommittedOutboxDispatchInput, "expectedChannel"> {
  dispatchers: DispatchRouterTable;
}

function failure(input: CommittedOutboxDispatchInput, code: string, message: string): Result<CommittedOutboxDispatchOutcome> {
  return { ok: true, value: { ...dispatchOutcomeBase(input.job), outcome: "TERMINAL_FAILURE", code, message } };
}

export async function dispatchCommittedOutboxJob(input: DispatchCommittedOutboxJobInput): Promise<Result<CommittedOutboxDispatchOutcome>> {
  // A corrupted decoded job cannot supply the identity fields required by
  // dispatchOutcomeBase(). Return a sanitized Result failure BEFORE that
  // helper, suppression policy or any provider adapter can dereference it.
  // Keep the existing persisted TERMINAL_FAILURE contract for valid jobs
  // whose attempt/timestamps are corrupt.
  const job = input?.job;
  if (!job || typeof job !== "object" || Array.isArray(job) ||
      !committedIdentity(job.id) ||
      !committedIdentity(job.workspaceId) ||
      !committedIdentity(job.idempotencyKey) ||
      !dispatchChannels.has(job.channel) ||
      !dispatchPurposes.has(job.purpose) ||
      !input.dispatchers || typeof input.dispatchers !== "object" ||
      Array.isArray(input.dispatchers) ||
      !job.recipient || typeof job.recipient !== "object" ||
      Array.isArray(job.recipient) ||
      typeof job.recipient.optedOut !== "boolean" ||
      typeof job.recipient.consentRequired !== "boolean" ||
      typeof job.recipient.hasOptIn !== "boolean" ||
      typeof job.recipient.recipientRef !== "string" ||
      job.recipient.recipientRef.length < 1 ||
      job.recipient.recipientRef.length > 256 ||
      job.recipient.recipientRef.trim() !== job.recipient.recipientRef ||
      /[\u0000-\u001f\u007f-\u009f\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/u.test(job.recipient.recipientRef) ||
      (job.recipient.quietHoursBlocked !== undefined &&
        typeof job.recipient.quietHoursBlocked !== "boolean") ||
      !job.payload || typeof job.payload !== "object" ||
      Array.isArray(job.payload) ||
      (job.handoverGuard !== undefined &&
        (!job.handoverGuard || typeof job.handoverGuard !== "object" ||
         Array.isArray(job.handoverGuard) ||
         !committedIdentity(job.handoverGuard.conversationId) ||
         !Number.isSafeInteger(job.handoverGuard.expectedConversationVersion) ||
         job.handoverGuard.expectedConversationVersion < 0 ||
         typeof job.handoverGuard.handoverActive !== "boolean"))) {
    return {
      ok: false,
      code: "OUTBOX_COMMIT_CLAIM_INVALID",
      message: "A committed outbox job is missing required identity or recipient policy fields.",
    };
  }
  // The outbox claim is the only authority for invoking an external provider.
  // Refuse corrupt attempts and timestamps BEFORE opt-in or dispatcher selection.
  // Otherwise malformed persisted jobs could still consume provider sends.
  const claimTime = utcMicros(input.committedAt);
  const createdTime = utcMicros(input.job.createdAt);
  const futureBoundary = BigInt(Date.now() + 5 * 60 * 1000) * 1000n;
  if (!Number.isSafeInteger(input.attempt) ||
      input.attempt < 1 || input.attempt > 1_000_000 ||
      claimTime === null || createdTime === null ||
      claimTime < createdTime ||
      claimTime > futureBoundary || createdTime > futureBoundary) {
    return failure(input, "OUTBOX_COMMIT_CLAIM_INVALID",
      "Committed outbox attempt or chronological claim evidence is invalid.");
  }
  if (input.expectedWorkspaceId && input.expectedWorkspaceId !== input.job.workspaceId) {
    return failure(input, "WORKSPACE_MISMATCH", "Committed outbox job workspace does not match the dispatch claim workspace.");
  }

  const suppression = hasRecipientSuppression(input.job);
  if (suppression) {
    return { ok: true, value: { ...dispatchOutcomeBase(input.job), outcome: "SUPPRESSED", code: suppression, message: `Dispatch suppressed by ${suppression}.` } };
  }

  const dispatcher = input.dispatchers[input.job.channel];
  if (!dispatcher) {
    return failure(input, "UNSUPPORTED_DISPATCH_CHANNEL", `No dispatcher is configured for ${input.job.channel}.`);
  }

  try {
    const result = await dispatcher.dispatch({
      job: input.job,
      committedAt: input.committedAt,
      attempt: input.attempt,
      expectedWorkspaceId: input.expectedWorkspaceId,
      expectedChannel: input.job.channel,
    });
    if (!result.ok) {
      // Provider adapters may include raw HTTP bodies, bearer tokens or
      // recipient data in error Result.message. Never forward them to the
      // persisted outbox or operator diagnostics.
      return failure(input, "PROVIDER_ADAPTER_REJECTED",
        "The provider adapter rejected this attempt; manual review required.");
    }

    // A success receipt must not be applied to a different committed job.
    // Connector implementations and provider payloads cannot authorize a
    // cross-workspace, cross-channel or unrelated idempotency transition.
    const outcome = result.value;
    if (!outcome || outcome.jobId !== input.job.id ||
        outcome.workspaceId !== input.job.workspaceId ||
        outcome.channel !== input.job.channel ||
        outcome.purpose !== input.job.purpose ||
        outcome.idempotencyKey !== input.job.idempotencyKey ||
        !["ACCEPTED", "RETRYABLE_FAILURE", "TERMINAL_FAILURE", "SUPPRESSED"].includes(outcome.outcome) ||
        (outcome.outcome === "ACCEPTED" &&
          !validAcceptedReceipt(outcome as unknown as Record<string, unknown>, input.committedAt))) {
      return failure(input, "DISPATCH_OUTCOME_IDENTITY_MISMATCH",
        "Provider adapter returned an invalid receipt for the claimed outbox job; manual review required.");
    }
    if (outcome.outcome !== "ACCEPTED") {
      // Failure strings/evidence are untrusted adapter data. Preserve the
      // classified state and a bounded machine code, not raw provider text.
      const code = typeof outcome.code === "string" &&
        /^[A-Z][A-Z0-9_]{0,79}$/.test(outcome.code)
          ? outcome.code : "PROVIDER_FAILURE_UNVERIFIED";
      const retry = outcome.outcome === "RETRYABLE_FAILURE" &&
        Number.isSafeInteger(outcome.retryAfterSeconds) &&
        (outcome.retryAfterSeconds ?? 0) > 0 &&
        (outcome.retryAfterSeconds ?? 0) <= 86_400
          ? { retryAfterSeconds: outcome.retryAfterSeconds } : {};
      return { ok: true, value: {
        ...dispatchOutcomeBase(input.job), outcome: outcome.outcome,
        code, message: "Provider outcome recorded without raw response data.",
        ...retry,
      } };
    }
    // Successful provider acknowledgement is not permission to persist the
    // adapter's arbitrary evidence notes or receipts. Keep only the verified
    // channel/mode/time and a bounded opaque diagnostic id.
    const rawEvidence = outcome.evidence;
    const controlledId =
      typeof rawEvidence.controlledId === "string" &&
      /^[A-Za-z0-9_.:-]{1,128}$/.test(rawEvidence.controlledId)
        ? { controlledId: rawEvidence.controlledId } : {};
    return { ok: true, value: {
      ...dispatchOutcomeBase(input.job),
      outcome: "ACCEPTED",
      providerMessageId: outcome.providerMessageId,
      acceptedAt: outcome.acceptedAt,
      providerMode: outcome.providerMode,
      evidence: {
        provider: input.job.channel,
        mode: outcome.providerMode,
        verification: rawEvidence.verification,
        capturedAt: rawEvidence.capturedAt,
        notes: [],
        ...controlledId,
      },
    } };
  } catch {
    // Never persist raw exceptions from provider transports: they can contain
    // URLs, customer identifiers, credentials or response bodies.
    return { ok: true, value: classifyProviderFailure({
      job: input.job, code: "UNKNOWN_PROVIDER_FAILURE",
      message: "Provider adapter threw an unexpected exception; manual review required.",
    }) };
  }
}
