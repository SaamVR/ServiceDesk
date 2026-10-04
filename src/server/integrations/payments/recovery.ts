import type { ProviderRecoveryAction, ProviderRecoveryDecision, ProviderRecoveryEvent, ProviderRecoveryOperation, ProviderRecoveryStatus } from "../recovery/policy";

export interface PaymentRecoveryEventInput {
  status: ProviderRecoveryStatus;
  operation: Extract<ProviderRecoveryOperation, "CALLBACK_APPLY" | "DELIVERY">;
  providerEventId: string;
  providerTransactionId: string;
  attempts: number;
  maxAttempts: number;
  occurredAt: string;
}

export interface PaymentRecoveryReceipt {
  provider: "PAYMENT";
  providerEventId: string;
  redactedTransactionRef: string;
  operation: ProviderRecoveryOperation;
  action: ProviderRecoveryAction;
  retryable: boolean;
  terminal: boolean;
  canMutateBusinessTruth: false;
  nextAttemptAt?: string;
  notes: string[];
}

function redactedTransactionRef(value: string): string {
  if (value.length <= 8) return "redacted";
  return `${value.slice(0, 3)}…${value.slice(-4)}`;
}

export function buildPaymentRecoveryEvent(input: PaymentRecoveryEventInput): ProviderRecoveryEvent {
  return {
    provider: "PAYMENT",
    operation: input.operation,
    status: input.status,
    attempts: input.attempts,
    maxAttempts: input.maxAttempts,
    occurredAt: input.occurredAt,
    idempotencyKey: `payment:${input.providerEventId}`,
    redactedTarget: redactedTransactionRef(input.providerTransactionId),
  };
}

export function buildPaymentRecoveryReceipt(event: ProviderRecoveryEvent, decision: ProviderRecoveryDecision): PaymentRecoveryReceipt {
  return {
    provider: "PAYMENT",
    providerEventId: event.idempotencyKey.replace(/^payment:/, ""),
    redactedTransactionRef: event.redactedTarget ?? "redacted",
    operation: event.operation,
    action: decision.action,
    retryable: decision.retryable,
    terminal: decision.terminal,
    canMutateBusinessTruth: false,
    nextAttemptAt: decision.nextAttemptAt,
    notes: decision.notes,
  };
}
