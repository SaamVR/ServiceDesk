import { describe, expect, test } from "vitest";
import { classifyPaymentReview } from "../../src/server/integrations/payments/review";
import type { VerifiedPaymentWebhook } from "../../src/server/integrations/types";

const webhook: VerifiedPaymentWebhook = {
  event: {
    provider: "STRIPE",
    providerAccountId: "acct_123",
    providerEventId: "evt_late_payment",
    providerTransactionId: "pi_late_payment",
    purpose: "DEPOSIT",
    workspaceId: "ws-clearnest",
    amountMinor: 8500,
    currency: "USD",
    occurredAt: "2026-10-04T10:16:00.000Z",
  },
  evidence: {
    provider: "PAYMENT",
    mode: "SANDBOX",
    verification: "CONTRACT_TESTED",
    capturedAt: "2026-10-04T10:16:05.000Z",
    notes: [],
  },
};

describe("expired-hold payment review", () => {
  test("routes payment occurring after hold expiry to manual review", () => {
    const item = classifyPaymentReview({
      webhook,
      applicationResult: "PAYMENT_REVIEW",
      expectedWorkspaceId: "ws-clearnest",
      expectedCurrency: "USD",
      expectedAmountMinor: 8500,
      holdExpiresAt: "2026-10-04T10:15:00.000Z",
    });

    expect(item).toMatchObject({
      reason: "LATE_EXPIRED_HOLD_PAYMENT",
      severity: "HIGH",
      requiresOperator: true,
      canMutateBusinessTruth: false,
    });
  });

  test("does not call an in-window payment late merely because callback processing is later", () => {
    const inWindow: VerifiedPaymentWebhook = {
      ...webhook,
      event: { ...webhook.event, occurredAt: "2026-10-04T10:14:59.000Z" },
    };

    const item = classifyPaymentReview({
      webhook: inWindow,
      applicationResult: "PAYMENT_REVIEW",
      expectedWorkspaceId: "ws-clearnest",
      expectedCurrency: "USD",
      expectedAmountMinor: 8500,
      holdExpiresAt: "2026-10-04T10:15:00.000Z",
    });

    expect(item.reason).toBe("APPLICATION_REQUESTED_REVIEW");
  });
});
