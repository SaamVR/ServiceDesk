import type { Result } from "../../../contracts";
import type { MessagingAdapter } from "../types";
import { dispatchOutcomeBase, type CommittedOutboxDispatcher, type CommittedOutboxDispatchInput, type CommittedOutboxDispatchOutcome } from "./dispatch-port";
import { classifyProviderFailure } from "./failure-policy";

export class WhatsAppCommittedOutboxDispatcher implements CommittedOutboxDispatcher {
  constructor(private readonly adapter: MessagingAdapter) {}

  async dispatch(input: CommittedOutboxDispatchInput): Promise<Result<CommittedOutboxDispatchOutcome>> {
    if (input.job.channel !== "WHATSAPP" || input.expectedChannel !== "WHATSAPP") {
      return { ok: true, value: classifyProviderFailure({ job: input.job, code: "CHANNEL_MISMATCH", message: "WhatsApp dispatcher received a non-WhatsApp outbox job." }) };
    }

    const sent = await this.adapter.send(input.job);
    if (!sent.ok) return { ok: true, value: classifyProviderFailure({ job: input.job, code: sent.code, message: sent.message }) };
    if (sent.value.jobId !== input.job.id) {
      return { ok: true, value: classifyProviderFailure({ job: input.job, code: "INVALID_PROVIDER_RESPONSE", message: "WhatsApp provider result job id did not match dispatch job." }) };
    }

    return {
      ok: true,
      value: {
        ...dispatchOutcomeBase(input.job),
        outcome: "ACCEPTED",
        providerMessageId: sent.value.providerMessageId,
        acceptedAt: sent.value.acceptedAt,
        providerMode: sent.value.mode,
        evidence: sent.value.evidence,
      },
    };
  }
}
