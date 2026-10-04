export type DeliveryLookupResult =
  | "FOUND_ACCEPTED"
  | "FOUND_DELIVERED"
  | "NOT_FOUND"
  | "LOOKUP_UNAVAILABLE";

export type DeliveryReconciliationAction =
  | "DO_NOT_RESEND"
  | "RETRY_ORIGINAL_IDEMPOTENCY_KEY"
  | "DEFER";

export interface DeliveryReconciliationInput {
  idempotencyKey: string;
  lookup: DeliveryLookupResult;
  checkedAt: string;
}

export interface DeliveryReconciliationDecision {
  action: DeliveryReconciliationAction;
  idempotencyKey: string;
  checkedAt: string;
  providerAccepted: boolean;
  delivered: boolean;
  retryable: boolean;
  requiresProviderLookup: boolean;
  duplicateSendRisk: boolean;
  mutatesBusinessTruth: false;
  notes: string[];
}

export function reconcileUncertainDelivery(input: DeliveryReconciliationInput): DeliveryReconciliationDecision {
  if (input.lookup === "FOUND_DELIVERED") {
    return {
      action: "DO_NOT_RESEND",
      idempotencyKey: input.idempotencyKey,
      checkedAt: input.checkedAt,
      providerAccepted: true,
      delivered: true,
      retryable: false,
      requiresProviderLookup: false,
      duplicateSendRisk: false,
      mutatesBusinessTruth: false,
      notes: ["Provider lookup confirmed recipient delivery; retry is suppressed."],
    };
  }

  if (input.lookup === "FOUND_ACCEPTED") {
    return {
      action: "DO_NOT_RESEND",
      idempotencyKey: input.idempotencyKey,
      checkedAt: input.checkedAt,
      providerAccepted: true,
      delivered: false,
      retryable: false,
      requiresProviderLookup: false,
      duplicateSendRisk: false,
      mutatesBusinessTruth: false,
      notes: ["Provider lookup confirmed provider acceptance; retry is suppressed until a later status or operator decision."],
    };
  }

  if (input.lookup === "NOT_FOUND") {
    return {
      action: "RETRY_ORIGINAL_IDEMPOTENCY_KEY",
      idempotencyKey: input.idempotencyKey,
      checkedAt: input.checkedAt,
      providerAccepted: false,
      delivered: false,
      retryable: true,
      requiresProviderLookup: false,
      duplicateSendRisk: false,
      mutatesBusinessTruth: false,
      notes: ["Provider lookup confirmed no prior send; retry may reuse the original logical idempotency key."],
    };
  }

  return {
    action: "DEFER",
    idempotencyKey: input.idempotencyKey,
    checkedAt: input.checkedAt,
    providerAccepted: false,
    delivered: false,
    retryable: false,
    requiresProviderLookup: true,
    duplicateSendRisk: true,
    mutatesBusinessTruth: false,
    notes: ["Provider lookup is unavailable; defer rather than risk a duplicate send."],
  };
}
