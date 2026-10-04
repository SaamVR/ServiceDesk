import type { PaymentWebhookApplicationResult } from "../../api-handlers/provider-stripe";

export interface PaymentApplicationSnapshot {
  providerEventId: string;
  providerTransactionId: string;
  occurredAt: string;
  amountMinor: number;
  currency: string;
  purpose: "DEPOSIT" | "BALANCE" | "PLATFORM_SUBSCRIPTION";
  workspaceId: string;
  state: "APPLIED" | "REVIEW";
}

export interface PaymentApplicationDecision {
  result: PaymentWebhookApplicationResult;
  next: PaymentApplicationSnapshot;
  reviewRequired: boolean;
}

function timestamp(value: string): number {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function materiallyMatches(current: PaymentApplicationSnapshot, incoming: PaymentApplicationSnapshot): boolean {
  return current.workspaceId === incoming.workspaceId
    && current.providerTransactionId === incoming.providerTransactionId
    && current.amountMinor === incoming.amountMinor
    && current.currency === incoming.currency
    && current.purpose === incoming.purpose;
}

export function decidePaymentApplicationState(
  current: PaymentApplicationSnapshot | undefined,
  incoming: PaymentApplicationSnapshot,
): PaymentApplicationDecision {
  if (!current) {
    return { result: "APPLIED", next: incoming, reviewRequired: false };
  }

  if (current.providerEventId === incoming.providerEventId) {
    return { result: "DUPLICATE", next: current, reviewRequired: false };
  }

  if (!materiallyMatches(current, incoming)) {
    return { result: "PAYMENT_REVIEW", next: current, reviewRequired: true };
  }

  if (timestamp(incoming.occurredAt) < timestamp(current.occurredAt)) {
    return { result: "OUT_OF_ORDER_IGNORED", next: current, reviewRequired: false };
  }

  return { result: "DUPLICATE", next: current, reviewRequired: false };
}
