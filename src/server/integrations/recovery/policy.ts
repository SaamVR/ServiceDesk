import type { RedactedProviderEvidence } from "../types";

export type RecoverableProvider = RedactedProviderEvidence["provider"];
export type ProviderRecoveryOperation = "OUTBOUND_SEND" | "INBOUND_PARSE" | "STATUS_CALLBACK" | "SYNC" | "CALLBACK_APPLY" | "DELIVERY";
export type ProviderRecoveryStatus = "TRANSIENT_FAILURE" | "PERMANENT_FAILURE" | "CONFIGURATION_BLOCKED" | "STALE_STATE" | "OUT_OF_ORDER" | "DUPLICATE";
export type ProviderRecoveryAction = "RETRY" | "DEAD_LETTER" | "BLOCKED_CONFIGURATION" | "RECONCILE" | "IGNORE_STALE" | "ACK_DUPLICATE" | "OPERATOR_REVIEW";

export interface ProviderRecoveryEvent {
  provider: RecoverableProvider;
  operation: ProviderRecoveryOperation;
  status: ProviderRecoveryStatus;
  attempts: number;
  maxAttempts: number;
  occurredAt: string;
  idempotencyKey: string;
  redactedTarget?: string;
}

export interface ProviderRecoveryDecision {
  provider: RecoverableProvider;
  operation: ProviderRecoveryOperation;
  action: ProviderRecoveryAction;
  retryable: boolean;
  terminal: boolean;
  preservesIdempotency: boolean;
  mutatesBusinessTruth: boolean;
  nextAttemptAt?: string;
  notes: string[];
}

export interface RecoveryQueueSummary {
  total: number;
  byProvider: Partial<Record<RecoverableProvider, number>>;
  byAction: Partial<Record<ProviderRecoveryAction, number>>;
}

export function nextRecoveryAttemptAt(from: string, nextAttemptNumber: number): string {
  const clampedAttempt = Math.max(1, Math.min(nextAttemptNumber, 6));
  const delayMinutes = Math.min(60, 2 ** clampedAttempt);
  return new Date(new Date(from).getTime() + delayMinutes * 60_000).toISOString();
}

export function classifyProviderRecovery(event: ProviderRecoveryEvent): ProviderRecoveryDecision {
  const base = {
    provider: event.provider,
    operation: event.operation,
    preservesIdempotency: true,
    mutatesBusinessTruth: false,
  };

  if (event.status === "DUPLICATE") {
    return {
      ...base,
      action: "ACK_DUPLICATE",
      retryable: false,
      terminal: true,
      notes: ["Duplicate provider event acknowledged through idempotency key.", `idempotencyKey=${event.idempotencyKey}`],
    };
  }

  if (event.status === "OUT_OF_ORDER") {
    return {
      ...base,
      action: "IGNORE_STALE",
      retryable: false,
      terminal: true,
      notes: ["Out-of-order provider callback ignored to avoid state regression.", `idempotencyKey=${event.idempotencyKey}`],
    };
  }

  if (event.status === "STALE_STATE") {
    return {
      ...base,
      action: "RECONCILE",
      retryable: false,
      terminal: false,
      notes: ["Provider state is stale; schedule reconciliation before future confirmation.", `idempotencyKey=${event.idempotencyKey}`],
    };
  }

  if (event.status === "CONFIGURATION_BLOCKED") {
    return {
      ...base,
      action: "BLOCKED_CONFIGURATION",
      retryable: false,
      terminal: true,
      notes: ["Provider recovery blocked by missing or invalid configuration.", `idempotencyKey=${event.idempotencyKey}`],
    };
  }

  if (event.status === "PERMANENT_FAILURE") {
    return {
      ...base,
      action: "DEAD_LETTER",
      retryable: false,
      terminal: true,
      notes: ["Provider returned a permanent failure; operator-visible dead-letter required.", `target=${event.redactedTarget ?? "redacted"}`],
    };
  }

  if (event.attempts >= event.maxAttempts) {
    return {
      ...base,
      action: "OPERATOR_REVIEW",
      retryable: false,
      terminal: true,
      notes: ["Provider retry budget exhausted; route to operator review.", `target=${event.redactedTarget ?? "redacted"}`],
    };
  }

  return {
    ...base,
    action: "RETRY",
    retryable: true,
    terminal: false,
    nextAttemptAt: nextRecoveryAttemptAt(event.occurredAt, event.attempts + 1),
    notes: ["Transient provider failure will be retried with original idempotency key.", `idempotencyKey=${event.idempotencyKey}`],
  };
}

export function summarizeRecoveryQueue(items: Array<{ provider: RecoverableProvider; action: ProviderRecoveryAction }>): RecoveryQueueSummary {
  return items.reduce<RecoveryQueueSummary>(
    (summary, item) => {
      summary.total += 1;
      summary.byProvider[item.provider] = (summary.byProvider[item.provider] ?? 0) + 1;
      summary.byAction[item.action] = (summary.byAction[item.action] ?? 0) + 1;
      return summary;
    },
    { total: 0, byProvider: {}, byAction: {} },
  );
}
