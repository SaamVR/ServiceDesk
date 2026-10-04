import { describe, expect, test } from "vitest";
import { classifyPaymentReview, enqueuePaymentReview, type PaymentReviewStore } from "../../src/server/integrations/payments/review";
import type { VerifiedPaymentWebhook } from "../../src/server/integrations";

function webhook(overrides: Partial<VerifiedPaymentWebhook["event"]> = {}): VerifiedPaymentWebhook {
  return {
    event: {
      provider: "STRIPE",
      providerAccountId: "acct_123",
      providerEventId: "evt_123",
      providerTransactionId: "pi_123",
      purpose: "DEPOSIT",
      workspaceId: "ws-clearnest",
      amountMinor: 8500,
      currency: "USD",
      occurredAt: "2026-10-04T12:00:00.000Z",
      ...overrides,
    },
    evidence: {
      provider: "PAYMENT",
      mode: "FIXTURE",
      verification: "CONTRACT_TESTED",
      capturedAt: "2026-10-04T12:00:01.000Z",
      controlledId: "evt_123",
      notes: ["fixture payment webhook"],
    },
  };
}

function review(overrides: Partial<Parameters<typeof classifyPaymentReview>[0]> = {}) {
  return classifyPaymentReview({
    webhook: webhook(),
    applicationResult: "PAYMENT_REVIEW",
    expectedWorkspaceId: "ws-clearnest",
    expectedCurrency: "USD",
    expectedAmountMinor: 8500,
    expectedProviderAccountId: "acct_123",
    expectedPurpose: "DEPOSIT",
    ...overrides,
  });
}

describe("payment review queue", () => {
  test("classifies out-of-order callback without applying payment truth", () => {
    const item = review({ applicationResult: "OUT_OF_ORDER_IGNORED" });

    expect(item).toMatchObject({ severity: "MEDIUM", reason: "OUT_OF_ORDER_CALLBACK", requiresOperator: true });
    expect(item.canMutateBusinessTruth).toBe(false);
  });

  test("classifies duplicate as acknowledged without operator review", () => {
    const item = review({ applicationResult: "DUPLICATE" });

    expect(item).toMatchObject({ severity: "INFO", reason: "DUPLICATE_ACKNOWLEDGED", requiresOperator: false });
    expect(item.reviewKey).toBe("payment-review:STRIPE:acct_123:evt_123:DUPLICATE_ACKNOWLEDGED");
  });

  test("classifies account, workspace, purpose, currency, amount, and hold-expiry mismatches", () => {
    expect(review({ webhook: webhook({ providerAccountId: "acct_other" }) })).toMatchObject({ reason: "ACCOUNT_MISMATCH", severity: "HIGH" });
    expect(review({ webhook: webhook({ workspaceId: "ws-other" }) })).toMatchObject({ reason: "WORKSPACE_MISMATCH", severity: "HIGH" });
    expect(review({ webhook: webhook({ purpose: "BALANCE" }) })).toMatchObject({ reason: "PURPOSE_MISMATCH", severity: "HIGH" });
    expect(review({ webhook: webhook({ currency: "EUR" }) })).toMatchObject({ reason: "CURRENCY_MISMATCH", severity: "HIGH" });
    expect(review({ webhook: webhook({ amountMinor: 9000 }) })).toMatchObject({ reason: "AMOUNT_MISMATCH", severity: "HIGH" });
    expect(review({ holdExpiresAt: "2026-10-04T11:00:00.000Z" })).toMatchObject({ reason: "LATE_EXPIRED_HOLD_PAYMENT", severity: "HIGH" });
  });

  test("review item stays redacted and non-mutating", () => {
    const item = review({ webhook: webhook({ providerTransactionId: "pi_secret_customer_reference" }) });

    expect(item.canMutateBusinessTruth).toBe(false);
    expect(item.reasonCodes).toEqual([item.reason]);
    expect(JSON.stringify(item)).not.toContain("customer");
    expect(JSON.stringify(item)).not.toContain("secret");
  });

  test("enqueue dedupes review items by provider event and reason", async () => {
    const calls: unknown[] = [];
    const store: PaymentReviewStore = {
      enqueuePaymentReview: async (item) => {
        calls.push(item);
        return { reviewId: "review_1", state: "DUPLICATE" };
      },
    };

    const result = await enqueuePaymentReview(store, review({ applicationResult: "OUT_OF_ORDER_IGNORED" }));

    expect(result).toEqual({ reviewId: "review_1", state: "DUPLICATE" });
    expect(calls[0]).toMatchObject({ dedupeKey: "STRIPE:acct_123:evt_123", reviewKey: "payment-review:STRIPE:acct_123:evt_123:OUT_OF_ORDER_CALLBACK", canMutateBusinessTruth: false });
  });
});
