export type DeliveryAttemptState =
  | "NEVER_SENT"
  | "PROVIDER_ACCEPTED"
  | "DELIVERED"
  | "UNCERTAIN"
  | "FAILED_RETRYABLE"
  | "FAILED_PERMANENT";

export type DeliveryRecoveryAction =
  | "RETRY"
  | "DO_NOT_RESEND"
  | "RECONCILE"
  | "DEAD_LETTER"
  | "OPERATOR_REVIEW";

export interface DeliveryRecoveryInput {
  state: DeliveryAttemptState;
  idempotencyKey: string;
  attempts: number;
  maxAttempts: number;
}

export interface DeliveryRecoveryDecision {
  action: DeliveryRecoveryAction;
  retryable: boolean;
  preservesIdempotency: true;
  requiresProviderLookup: boolean;
  duplicateSendRisk: boolean;
  mutatesBusinessTruth: false;
  notes: string[];
}

export interface DeadLetterRedriveInput {
  originalIdempotencyKey: string;
  operatorReason: string;
  requestedAt: string;
}

export interface DeadLetterRedrive {
  action: "RETRY";
  idempotencyKey: string;
  operatorApproved: true;
  requestedAt: string;
  operatorReason: string;
  mutatesBusinessTruth: false;
}

export function decideDeliveryRecovery(input: DeliveryRecoveryInput): DeliveryRecoveryDecision {
  const base = {
    preservesIdempotency: true as const,
    mutatesBusinessTruth: false as const,
  };

  if (input.state === "PROVIDER_ACCEPTED" || input.state === "DELIVERED") {
    return {
      ...base,
      action: "DO_NOT_RESEND",
      retryable: false,
      requiresProviderLookup: false,
      duplicateSendRisk: false,
      notes: ["Provider acceptance/delivery is already recorded; worker restart must not resend."],
    };
  }

  if (input.state === "UNCERTAIN") {
    return {
      ...base,
      action: "RECONCILE",
      retryable: false,
      requiresProviderLookup: true,
      duplicateSendRisk: true,
      notes: ["Send outcome is uncertain; reconcile with provider before any retry."],
    };
  }

  if (input.state === "FAILED_PERMANENT") {
    return {
      ...base,
      action: "DEAD_LETTER",
      retryable: false,
      requiresProviderLookup: false,
      duplicateSendRisk: false,
      notes: ["Permanent delivery failure requires an operator-visible dead letter."],
    };
  }

  if (input.attempts >= input.maxAttempts) {
    return {
      ...base,
      action: "OPERATOR_REVIEW",
      retryable: false,
      requiresProviderLookup: false,
      duplicateSendRisk: false,
      notes: ["Delivery retry budget is exhausted; operator review is required."],
    };
  }

  return {
    ...base,
    action: "RETRY",
    retryable: true,
    requiresProviderLookup: false,
    duplicateSendRisk: false,
    notes: ["Delivery can retry with the original logical idempotency key."],
  };
}

export function redriveDeadLetter(input: DeadLetterRedriveInput): DeadLetterRedrive {
  if (!input.operatorReason.trim()) {
    throw new Error("Operator reason is required to redrive a provider dead letter.");
  }

  return {
    action: "RETRY",
    idempotencyKey: input.originalIdempotencyKey,
    operatorApproved: true,
    requestedAt: input.requestedAt,
    operatorReason: input.operatorReason.trim(),
    mutatesBusinessTruth: false,
  };
}
