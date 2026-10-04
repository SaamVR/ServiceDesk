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

describe("payment review queue", () => {
  test("classifies out-of-order callback without applying payment truth", () => {
    const review = classifyPaymentReview({
      webhook: webhook(),
      applicationResult: "OUT_OF_ORDER_IGNORED",
      expectedWorkspaceId: "ws-clearnest",
      expectedCurrency: "USD",
      expectedAmountMinor: 8500,
    });

    expect(review).toMatchObject({ severity: "MEDIUM", reason: "OUT_OF_ORDER_CALLBACK", requiresOperator: true });
    expect(review.canMutateBusinessTruth).toBe(false);
  });

  test("classifies amount mismatch as high risk manual review", () => {
    const review = classifyPaymentReview({
      webhook: webhook({ amountMinor: 9000 }),
      applicationResult: "PAYMENT_REVIEW",
      expectedWorkspaceId: "ws-clearnest",
      expectedCurrency: "USD",
      expectedAmountMinor: 8500,
    });

    expect(review).toMatchObject({ severity: "HIGH", reason: "AMOUNT_MISMATCH", requiresOperator: true });
  });

  test("classifies duplicate as no review needed", () => {
    const review = classifyPaymentReview({
      webhook: webhook(),
      applicationResult: "DUPLICATE",
      expectedWorkspaceId: "ws-clearnest",
      expectedCurrency: "USD",
      expectedAmountMinor: 8500,
    });

    expect(review).toMatchObject({ severity: "INFO", reason: "DUPLICATE_ACKNOWLEDGED", requiresOperator: false });
  });

  test("enqueue dedupes review items by provider event", async () => {
    const calls: unknown[] = [];
    const store: PaymentReviewStore = {
      enqueuePaymentReview: async (item) => {
        calls.push(item);
        return { reviewId: "review_1", state: "DUPLICATE" };
      },
    };

    const result = await enqueuePaymentReview(store, classifyPaymentReview({
      webhook: webhook(),
      applicationResult: "OUT_OF_ORDER_IGNORED",
      expectedWorkspaceId: "ws-clearnest",
      expectedCurrency: "USD",
      expectedAmountMinor: 8500,
    }));

    expect(result).toEqual({ reviewId: "review_1", state: "DUPLICATE" });
    expect(calls[0]).toMatchObject({ dedupeKey: "STRIPE:acct_123:evt_123", canMutateBusinessTruth: false });
  });
});
