import { describe, expect, it } from "vitest";
import { createPaymentApplicationFacadeMethods } from "../../src/server/core/payment-application-facade";
import type { PaymentApplicationRepository } from "../../src/server/core/payment-application-repository";

describe("payment application facade", () => {
  it("delegates verified payment events through the injected transaction repository", async () => {
    const seen: string[] = [];
    const paymentApplicationRepository: PaymentApplicationRepository = {
      transaction: async () => {
        seen.push("transaction");
        return { ok: true, value: { state: "DUPLICATE" as const } };
      },
    };
    const facade = createPaymentApplicationFacadeMethods({ paymentApplicationRepository });
    await expect(facade.applyVerifiedPayment({
      provider: "stripe",
      providerAccountId: "acct_demo",
      providerEventId: "evt_1",
      providerTransactionId: "pi_1",
      purpose: "DEPOSIT",
      workspaceId: "ws_1",
      amountMinor: 8_500,
      currency: "USD",
      occurredAt: "2026-10-04T06:05:00.000Z",
      quoteId: "quote_1",
      holdId: "hold_1",
    })).resolves.toEqual({ ok: true, value: { state: "DUPLICATE" } });
    expect(seen).toEqual(["transaction"]);
  });
});
