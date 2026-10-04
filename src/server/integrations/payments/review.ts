import type { VerifiedPaymentWebhook } from "../types";

export type PaymentApplicationResult = "APPLIED" | "DUPLICATE" | "OUT_OF_ORDER_IGNORED" | "PAYMENT_REVIEW";
export type PaymentReviewReason =
  | "DUPLICATE_ACKNOWLEDGED"
  | "OUT_OF_ORDER_CALLBACK"
  | "AMOUNT_MISMATCH"
  | "CURRENCY_MISMATCH"
  | "WORKSPACE_MISMATCH"
  | "LATE_EXPIRED_HOLD_PAYMENT"
  | "APPLICATION_REQUESTED_REVIEW";

export type PaymentReviewSeverity = "INFO" | "MEDIUM" | "HIGH";

export interface PaymentReviewClassificationInput {
  webhook: VerifiedPaymentWebhook;
  applicationResult: PaymentApplicationResult;
  expectedWorkspaceId: string;
  expectedCurrency: string;
  expectedAmountMinor: number;
  holdExpiresAt?: string;
}

export interface PaymentReviewItem {
  dedupeKey: string;
  workspaceId: string;
  provider: string;
  providerAccountId: string;
  providerEventId: string;
  providerTransactionId: string;
  purpose: string;
  reason: PaymentReviewReason;
  severity: PaymentReviewSeverity;
  requiresOperator: boolean;
  canMutateBusinessTruth: false;
  evidenceVerification: string;
  notes: string[];
}

export interface PaymentReviewStore {
  enqueuePaymentReview(item: PaymentReviewItem): Promise<{ reviewId: string; state: "INSERTED" | "DUPLICATE" }>;
}

function dedupeKey(webhook: VerifiedPaymentWebhook): string {
  const event = webhook.event;
  return `${event.provider}:${event.providerAccountId}:${event.providerEventId}`;
}

function occurredAfter(occurredAt: string, boundary: string | undefined): boolean {
  if (!boundary) return false;
  return new Date(occurredAt).getTime() > new Date(boundary).getTime();
}

export function classifyPaymentReview(input: PaymentReviewClassificationInput): PaymentReviewItem {
  const event = input.webhook.event;
  const notes: string[] = [];
  let reason: PaymentReviewReason = "APPLICATION_REQUESTED_REVIEW";
  let severity: PaymentReviewSeverity = "MEDIUM";
  let requiresOperator = true;

  if (input.applicationResult === "DUPLICATE") {
    reason = "DUPLICATE_ACKNOWLEDGED";
    severity = "INFO";
    requiresOperator = false;
    notes.push("Duplicate provider callback acknowledged without applying another business transaction.");
  } else if (event.workspaceId !== input.expectedWorkspaceId) {
    reason = "WORKSPACE_MISMATCH";
    severity = "HIGH";
    notes.push("Provider callback workspace does not match the expected workspace context.");
  } else if (event.currency !== input.expectedCurrency) {
    reason = "CURRENCY_MISMATCH";
    severity = "HIGH";
    notes.push("Provider callback currency differs from server-side expectation.");
  } else if (event.amountMinor !== input.expectedAmountMinor) {
    reason = "AMOUNT_MISMATCH";
    severity = "HIGH";
    notes.push("Provider callback amount differs from server-side quote or invoice expectation.");
  } else if (occurredAfter(event.occurredAt, input.holdExpiresAt)) {
    reason = "LATE_EXPIRED_HOLD_PAYMENT";
    severity = "HIGH";
    notes.push("Verified payment occurred after the server-side hold expired; booking confirmation requires core review.");
  } else if (input.applicationResult === "OUT_OF_ORDER_IGNORED") {
    reason = "OUT_OF_ORDER_CALLBACK";
    severity = "MEDIUM";
    notes.push("Callback is older than or inconsistent with a later verified payment state; business truth was not regressed.");
  } else {
    notes.push("Payment application requested manual review without granting mutation authority to this adapter.");
  }

  return {
    dedupeKey: dedupeKey(input.webhook),
    workspaceId: event.workspaceId,
    provider: event.provider,
    providerAccountId: event.providerAccountId,
    providerEventId: event.providerEventId,
    providerTransactionId: event.providerTransactionId,
    purpose: event.purpose,
    reason,
    severity,
    requiresOperator,
    canMutateBusinessTruth: false,
    evidenceVerification: input.webhook.evidence.verification,
    notes,
  };
}

export async function enqueuePaymentReview(store: PaymentReviewStore, item: PaymentReviewItem): Promise<{ reviewId: string; state: "INSERTED" | "DUPLICATE" }> {
  return store.enqueuePaymentReview(item);
}
