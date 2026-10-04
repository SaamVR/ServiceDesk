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
    return await dispatcher.dispatch({
      job: input.job,
      committedAt: input.committedAt,
      attempt: input.attempt,
      expectedWorkspaceId: input.expectedWorkspaceId,
      expectedChannel: input.job.channel,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown dispatch error";
    return { ok: true, value: classifyProviderFailure({ job: input.job, code: "UNKNOWN_PROVIDER_FAILURE", message }) };
  }
}
