import { describe, expect, test } from "vitest";
import { E03_PAYMENT_APPLICATION_OUTCOME_DEPENDENCY, verifiedPaymentEventForCore, verifiedPaymentWebhookEventCompatibility } from "../../src/server/integrations/payments/verified-payment-compatibility";
import type { VerifiedPaymentWebhook } from "../../src/server/integrations/types";

describe("verified payment webhook event compatibility", () => {
  test("returns the Core VerifiedPaymentEvent without field loss", () => {
    const webhook: VerifiedPaymentWebhook = {
      event: {
        provider: "STRIPE",
        providerAccountId: "acct_1",
        providerEventId: "evt_1",
        providerTransactionId: "pi_1",
        purpose: "DEPOSIT",
        workspaceId: "ws-1",
        amountMinor: 1000,
        currency: "USD",
        occurredAt: "2026-10-04T12:02:00.000Z",
      },
      evidence: { provider: "PAYMENT", mode: "FIXTURE", verification: "CONTRACT_TESTED", capturedAt: "2026-10-04T12:02:00.000Z", notes: [] },
    };

    expect(verifiedPaymentWebhookEventCompatibility).toBe(true);
    expect(verifiedPaymentEventForCore(webhook)).toEqual(webhook.event);
    expect(E03_PAYMENT_APPLICATION_OUTCOME_DEPENDENCY).toContain("applied/duplicate/review");
  });
});
