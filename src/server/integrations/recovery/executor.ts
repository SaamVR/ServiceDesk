import { nextRecoveryAttemptAt } from "./policy";
import type { ProviderRecoveryQueueRecord } from "./queue";

export type ProviderRecoveryAttemptOutcome = "SUCCESS" | "TRANSIENT_FAILURE" | "PERMANENT_FAILURE" | "CONFIGURATION_BLOCKED";
export type ProviderRecoveryAttemptDisposition = "COMPLETE" | "REQUEUE" | "OPERATOR_REVIEW" | "DEAD_LETTER" | "BLOCKED_CONFIGURATION";

export interface ProviderRecoveryAttemptInput {
  record: ProviderRecoveryQueueRecord;
  outcome: ProviderRecoveryAttemptOutcome;
  attemptedAt: string;
}

export interface ProviderRecoveryAttemptResult {
  disposition: ProviderRecoveryAttemptDisposition;
  enqueue: boolean;
  mutatesBusinessTruth: false;
  record?: ProviderRecoveryQueueRecord;
}

function withQueue(
  record: ProviderRecoveryQueueRecord,
  queue: ProviderRecoveryQueueRecord["queue"],
  action: ProviderRecoveryQueueRecord["action"],
  attempts: number,
  attemptedAt: string,
  operatorVisible: boolean,
  nextAttemptAt?: string,
): ProviderRecoveryQueueRecord {
  return {
    ...record,
    queue,
    action,
    attempts,
    queuedAt: attemptedAt,
    operatorVisible,
    nextAttemptAt,
    mutatesBusinessTruth: false,
  };
}

export function applyRecoveryAttemptResult(input: ProviderRecoveryAttemptInput): ProviderRecoveryAttemptResult {
  if (input.outcome === "SUCCESS") {
    return {
      disposition: "COMPLETE",
      enqueue: false,
      mutatesBusinessTruth: false,
    };
  }

  const nextAttempts = input.record.attempts + 1;

  if (input.outcome === "PERMANENT_FAILURE") {
    return {
      disposition: "DEAD_LETTER",
      enqueue: true,
      mutatesBusinessTruth: false,
      record: withQueue(
        input.record,
        "provider-dead-letter",
        "DEAD_LETTER",
        nextAttempts,
        input.attemptedAt,
        true,
      ),
    };
  }

  if (input.outcome === "CONFIGURATION_BLOCKED") {
    return {
      disposition: "BLOCKED_CONFIGURATION",
      enqueue: true,
      mutatesBusinessTruth: false,
      record: withQueue(
        input.record,
        "provider-configuration-blocked",
        "BLOCKED_CONFIGURATION",
        nextAttempts,
        input.attemptedAt,
        true,
      ),
    };
  }

  if (nextAttempts >= input.record.maxAttempts) {
    return {
      disposition: "OPERATOR_REVIEW",
      enqueue: true,
      mutatesBusinessTruth: false,
      record: withQueue(
        input.record,
        "provider-operator-review",
        "OPERATOR_REVIEW",
        nextAttempts,
        input.attemptedAt,
        true,
      ),
    };
  }

  return {
    disposition: "REQUEUE",
    enqueue: true,
    mutatesBusinessTruth: false,
    record: withQueue(
      input.record,
      "provider-retry",
      "RETRY",
      nextAttempts,
      input.attemptedAt,
      false,
      nextRecoveryAttemptAt(input.attemptedAt, nextAttempts + 1),
    ),
  };
}
