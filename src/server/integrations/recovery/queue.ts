import type { ProviderRecoveryDecision, ProviderRecoveryEvent } from "./policy";

export type ProviderRecoveryQueueName =
  | "provider-retry"
  | "provider-reconciliation"
  | "provider-operator-review"
  | "provider-dead-letter"
  | "provider-configuration-blocked";

export interface ProviderRecoveryQueueRecord {
  queue: ProviderRecoveryQueueName;
  workspaceId: string;
  provider: ProviderRecoveryEvent["provider"];
  operation: ProviderRecoveryEvent["operation"];
  action: ProviderRecoveryDecision["action"];
  idempotencyKey: string;
  attempts: number;
  maxAttempts: number;
  queuedAt: string;
  occurredAt: string;
  nextAttemptAt?: string;
  leaseExpiresAt?: string;
  leasedBy?: string;
  redactedTarget?: string;
  operatorVisible: boolean;
  mutatesBusinessTruth: false;
  notes: string[];
}

export interface BuildRecoveryQueueRecordInput {
  workspaceId: string;
  event: ProviderRecoveryEvent;
  decision: ProviderRecoveryDecision;
  queuedAt: string;
}

function queueForAction(action: ProviderRecoveryDecision["action"]): ProviderRecoveryQueueName | undefined {
  switch (action) {
    case "RETRY":
      return "provider-retry";
    case "RECONCILE":
      return "provider-reconciliation";
    case "OPERATOR_REVIEW":
      return "provider-operator-review";
    case "DEAD_LETTER":
      return "provider-dead-letter";
    case "BLOCKED_CONFIGURATION":
      return "provider-configuration-blocked";
    case "ACK_DUPLICATE":
    case "IGNORE_STALE":
      return undefined;
  }
}

export function buildRecoveryQueueRecord(input: BuildRecoveryQueueRecordInput): ProviderRecoveryQueueRecord | undefined {
  const queue = queueForAction(input.decision.action);
  if (!queue) return undefined;

  const operatorVisible =
    input.decision.action === "OPERATOR_REVIEW" ||
    input.decision.action === "DEAD_LETTER" ||
    input.decision.action === "BLOCKED_CONFIGURATION";

  return {
    queue,
    workspaceId: input.workspaceId,
    provider: input.event.provider,
    operation: input.event.operation,
    action: input.decision.action,
    idempotencyKey: input.event.idempotencyKey,
    attempts: input.event.attempts,
    maxAttempts: input.event.maxAttempts,
    queuedAt: input.queuedAt,
    occurredAt: input.event.occurredAt,
    nextAttemptAt: input.decision.nextAttemptAt,
    redactedTarget: input.event.redactedTarget,
    operatorVisible,
    mutatesBusinessTruth: false,
    notes: [...input.decision.notes],
  };
}
