import { describe, expect, test } from "vitest";
import type { QuoteDTO } from "../../src/contracts";
import type { CheckoutInput } from "../../src/server/integrations/types";
import { FixtureStripePaymentAdapter } from "../../src/server/integrations/payments/adapter";

const quote: QuoteDTO = {
  id: "quote-1",
  workspaceId: "ws-clearnest",
  requestId: "request-1",
  version: 1,
  status: "APPROVED",
  currency: "USD",
  subtotalMinor: 34000,
  taxMinor: 0,
  totalMinor: 34000,
  depositMinor: 8500,
  balanceMinor: 25500,
  durationMinutes: 240,
  bufferMinutes: 30,
  rateVersion: "v1",
  validUntil: "2026-10-05T00:00:00.000Z",
};

function input(overrides: Partial<CheckoutInput> = {}): CheckoutInput {
  return {
    hold: { holdId: "hold-1", workspaceId: "ws-clearnest", quoteId: "quote-1", expiresAt: "2026-10-04T10:30:00.000Z" },
    quote,
    purpose: "DEPOSIT",
    successUrl: "https://servicedesk.test/success",
    cancelUrl: "https://servicedesk.test/cancel",
    ...overrides,
  };
}

describe("fixture payment checkout hardening", () => {
  test("rejects expired holds and invalid purposes in fixture checkout", async () => {
    const adapter = new FixtureStripePaymentAdapter("secret", "acct_123", () => "2026-10-04T10:00:00.000Z");

    expect(await adapter.createCheckout(input({ hold: { holdId: "hold-1", workspaceId: "ws-clearnest", quoteId: "quote-1", expiresAt: "2026-10-04T10:00:00.000Z" } }))).toMatchObject({ ok: false, code: "PAYMENT_HOLD_EXPIRED" });
    expect(await adapter.createCheckout(input({ purpose: "TIP" as CheckoutInput["purpose"] }))).toMatchObject({ ok: false, code: "PAYMENT_PURPOSE_INVALID" });
  });

  test("uses total amount for platform subscription fixture checkout", async () => {
    const adapter = new FixtureStripePaymentAdapter("secret", "acct_123", () => "2026-10-04T10:00:00.000Z");
    const result = await adapter.createCheckout(input({ purpose: "PLATFORM_SUBSCRIPTION" }));

    expect(result).toMatchObject({ ok: true, value: { amountMinor: 34000, currency: "USD" } });
  });
});
