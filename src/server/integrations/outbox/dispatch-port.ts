import type { Result } from "../../../contracts";
import type { DeliveryChannel, DeliveryPurpose, OutboxJob, ProviderMode, RedactedProviderEvidence } from "../types";

export type CommittedOutboxDispatchOutcomeKind = "ACCEPTED" | "RETRYABLE_FAILURE" | "TERMINAL_FAILURE" | "SUPPRESSED";

export interface CommittedOutboxDispatchInput {
  job: OutboxJob;
  committedAt: string;
  attempt: number;
  expectedWorkspaceId?: string;
  expectedChannel?: DeliveryChannel;
}

export interface CommittedOutboxDispatchBaseOutcome {
  outcome: CommittedOutboxDispatchOutcomeKind;
  jobId: string;
  workspaceId: string;
  channel: DeliveryChannel;
  purpose: DeliveryPurpose;
  idempotencyKey: string;
}

export interface CommittedOutboxDispatchAccepted extends CommittedOutboxDispatchBaseOutcome {
  outcome: "ACCEPTED";
  providerMessageId: string;
  acceptedAt: string;
  providerMode: ProviderMode;
  evidence: RedactedProviderEvidence;
}

export interface CommittedOutboxDispatchFailure extends CommittedOutboxDispatchBaseOutcome {
  outcome: "RETRYABLE_FAILURE" | "TERMINAL_FAILURE" | "SUPPRESSED";
  code: string;
  message: string;
  retryAfterSeconds?: number;
  evidence?: RedactedProviderEvidence;
}

export type CommittedOutboxDispatchOutcome = CommittedOutboxDispatchAccepted | CommittedOutboxDispatchFailure;

export interface CommittedOutboxDispatcher {
  dispatch(input: CommittedOutboxDispatchInput): Promise<Result<CommittedOutboxDispatchOutcome>>;
}

export function dispatchOutcomeBase(job: OutboxJob): Pick<CommittedOutboxDispatchBaseOutcome, "jobId" | "workspaceId" | "channel" | "purpose" | "idempotencyKey"> {
  return {
    jobId: job.id,
    workspaceId: job.workspaceId,
    channel: job.channel,
    purpose: job.purpose,
    idempotencyKey: job.idempotencyKey,
  };
}
