import type { Result } from "../../../contracts";
import { hasRecipientSuppression, type DeliveryChannel } from "../types";
import { classifyProviderFailure } from "./failure-policy";
import { dispatchOutcomeBase, type CommittedOutboxDispatcher, type CommittedOutboxDispatchInput, type CommittedOutboxDispatchOutcome } from "./dispatch-port";

export type DispatchRouterTable = Partial<Record<DeliveryChannel, CommittedOutboxDispatcher>>;

export interface DispatchCommittedOutboxJobInput extends Omit<CommittedOutboxDispatchInput, "expectedChannel"> {
  dispatchers: DispatchRouterTable;
}

function failure(input: CommittedOutboxDispatchInput, code: string, message: string): Result<CommittedOutboxDispatchOutcome> {
  return { ok: true, value: { ...dispatchOutcomeBase(input.job), outcome: "TERMINAL_FAILURE", code, message } };
}

export async function dispatchCommittedOutboxJob(input: DispatchCommittedOutboxJobInput): Promise<Result<CommittedOutboxDispatchOutcome>> {
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
    if (!result.ok) return result;

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
          (typeof outcome.providerMessageId !== "string" || !outcome.providerMessageId.trim()))) {
      return failure(input, "DISPATCH_OUTCOME_IDENTITY_MISMATCH",
        "Provider adapter returned an invalid receipt for the claimed outbox job; manual review required.");
    }
    return result;
  } catch {
    // Never persist raw exceptions from provider transports: they can contain
    // URLs, customer identifiers, credentials or response bodies.
    return { ok: true, value: classifyProviderFailure({
      job: input.job, code: "UNKNOWN_PROVIDER_FAILURE",
      message: "Provider adapter threw an unexpected exception; manual review required.",
    }) };
  }
}
