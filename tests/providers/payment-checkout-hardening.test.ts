import { describe, expect, test } from "vitest";
import type { QuoteDTO } from "../../src/contracts";
import type { CheckoutInput } from "../../src/server/integrations/types";
import { createStripeCheckoutSession, type StripeCheckoutHttpTransport } from "../../src/server/integrations/payments/stripe-checkout";

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

const config = {
  apiBaseUrl: "https://api.stripe.com/v1",
  secretKey: "sk_test_secret",
  providerAccountId: "acct_platform",
  mode: "SANDBOX" as const,
  now: () => "2026-10-04T10:00:00.000Z",
};

function checkoutInput(overrides: Partial<CheckoutInput> = {}): CheckoutInput {
  return {
    hold: { holdId: "hold-1", workspaceId: "ws-clearnest", quoteId: "quote-1", expiresAt: "2026-10-04T10:30:00.000Z" },
    quote,
    purpose: "DEPOSIT",
    successUrl: "https://servicedesk.test/payments/success",
    cancelUrl: "https://servicedesk.test/payments/cancel",
    ...overrides,
  };
}

describe("payment checkout hardening", () => {
  test("rejects expired holds before creating a provider checkout session", async () => {
    let calls = 0;
    const http: StripeCheckoutHttpTransport = async () => {
      calls += 1;
      return { status: 200, body: JSON.stringify({ id: "cs_test", url: "https://checkout.stripe.test/cs_test" }) };
    };

    const result = await createStripeCheckoutSession(
      config,
      checkoutInput({ hold: { holdId: "hold-1", workspaceId: "ws-clearnest", quoteId: "quote-1", expiresAt: "2026-10-04T10:00:00.000Z" } }),
      http,
    );

    expect(result).toMatchObject({ ok: false, code: "PAYMENT_HOLD_EXPIRED" });
    expect(calls).toBe(0);
  });

  test("rejects unsupported payment purpose before provider transport", async () => {
    let calls = 0;
    const result = await createStripeCheckoutSession(
      config,
      checkoutInput({ purpose: "TIP" as CheckoutInput["purpose"] }),
      async () => {
        calls += 1;
        return { status: 200, body: "{}" };
      },
    );

    expect(result).toMatchObject({ ok: false, code: "PAYMENT_PURPOSE_INVALID" });
    expect(calls).toBe(0);
  });

  test("uses server-derived total for platform subscription purpose", async () => {
    let captured: Parameters<StripeCheckoutHttpTransport>[0] | undefined;
    const result = await createStripeCheckoutSession(
      config,
      checkoutInput({ purpose: "PLATFORM_SUBSCRIPTION" }),
      async (request) => {
        captured = request;
        return { status: 200, body: JSON.stringify({ id: "cs_subscription", url: "https://checkout.stripe.test/cs_subscription" }) };
      },
    );

    expect(result.ok).toBe(true);
    const body = new URLSearchParams(captured?.body ?? "");
    expect(body.get("line_items[0][price_data][unit_amount]")).toBe("34000");
    expect(body.get("metadata[purpose]")).toBe("PLATFORM_SUBSCRIPTION");
  });
});
