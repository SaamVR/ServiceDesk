import { describe, expect, test } from "vitest";
import type { VerifiedPaymentWebhook } from "../../src/server/integrations/types";
import { routePaymentWebhookToReview, type PaymentReviewRouteStore } from "../../src/server/integrations/payments/review-bridge";

function webhook(overrides: Partial<VerifiedPaymentWebhook["event"]> = {}): VerifiedPaymentWebhook {
  return {
    event: {
      provider: "STRIPE",
      providerAccountId: "acct_123",
      providerEventId: "evt_review_1",
      providerTransactionId: "pi_sensitive_1234",
      purpose: "DEPOSIT",
      workspaceId: "ws-clearnest",
      amountMinor: 8500,
      currency: "USD",
      occurredAt: "2026-10-04T10:00:00.000Z",
      ...overrides,
    },
    evidence: {
      provider: "PAYMENT",
      mode: "SANDBOX",
      verification: "CONTRACT_TESTED",
      capturedAt: "2026-10-04T10:00:00.000Z",
      controlledId: "evt_review_1",
      notes: ["fixture only"],
    },
  };
}

describe("payment review bridge", () => {
  test("routes verified mismatched callbacks to operator review without business mutation authority", async () => {
    const inserted: unknown[] = [];
    const store: PaymentReviewRouteStore = {
      async enqueuePaymentReview(item) {
        inserted.push(item);
        return { reviewId: "review-1", state: "INSERTED" };
      },
    };

    const result = await routePaymentWebhookToReview({
      webhook: webhook({ amountMinor: 8600 }),
      applicationResult: "PAYMENT_REVIEW",
      expectedWorkspaceId: "ws-clearnest",
      expectedCurrency: "USD",
      expectedAmountMinor: 8500,
      expectedProviderAccountId: "acct_123",
      expectedPurpose: "DEPOSIT",
      store,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toMatchObject({ reviewId: "review-1", state: "INSERTED", reason: "AMOUNT_MISMATCH", canMutateBusinessTruth: false });
      expect(result.value.providerTransactionRef).toBe("pi_…1234");
    }
    expect(JSON.stringify(inserted)).not.toContain("pi_sensitive_1234");
  });

  test("returns retryable failure when review enqueue persistence fails", async () => {
    const result = await routePaymentWebhookToReview({
      webhook: webhook(),
      applicationResult: "PAYMENT_REVIEW",
      expectedWorkspaceId: "ws-clearnest",
      expectedCurrency: "USD",
      expectedAmountMinor: 8500,
      store: {
        async enqueuePaymentReview() {
          throw new Error("queue unavailable");
        },
      },
    });

    expect(result).toMatchObject({ ok: false, code: "PAYMENT_REVIEW_ENQUEUE_FAILED" });
  });
});
