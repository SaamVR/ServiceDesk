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

const config = {
  apiBaseUrl: "https://api.stripe.com/v1",
  secretKey: "sk_test_secret",
  providerAccountId: "acct_platform",
  mode: "SANDBOX" as const,
  now: () => "2026-10-04T10:00:00.000Z",
};

describe("Stripe checkout transport", () => {
  test("creates checkout session from server-derived deposit amount with idempotency and metadata", async () => {
    let captured: Parameters<StripeCheckoutHttpTransport>[0] | undefined;
    const result = await createStripeCheckoutSession(config, checkoutInput(), async (request) => {
      captured = request;
      return { status: 200, body: JSON.stringify({ id: "cs_test_123", url: "https://checkout.stripe.test/cs_test_123" }) };
    });

    expect(result.ok).toBe(true);
    expect(captured?.method).toBe("POST");
    expect(captured?.url).toBe("https://api.stripe.com/v1/checkout/sessions");
    expect(captured?.headers.authorization).toBe("Bearer sk_test_secret");
    expect(captured?.headers["idempotency-key"]).toBe("checkout:ws-clearnest:hold-1:DEPOSIT");
    const body = new URLSearchParams(captured?.body ?? "");
    expect(body.get("mode")).toBe("payment");
    expect(body.get("line_items[0][price_data][unit_amount]")).toBe("8500");
    expect(body.get("line_items[0][price_data][currency]")).toBe("usd");
    expect(body.get("metadata[workspaceId]")).toBe("ws-clearnest");
    expect(body.get("metadata[quoteId]")).toBe("quote-1");
    expect(body.get("metadata[holdId]")).toBe("hold-1");
    expect(body.get("metadata[purpose]")).toBe("DEPOSIT");
    if (result.ok) {
      expect(result.value).toMatchObject({ provider: "STRIPE", providerSessionId: "cs_test_123", amountMinor: 8500, currency: "USD" });
      expect(JSON.stringify(result.value.evidence)).not.toContain("sk_test_secret");
    }
  });

  test("uses balance amount for balance checkout and optional connected account header", async () => {
    let captured: Parameters<StripeCheckoutHttpTransport>[0] | undefined;
    const result = await createStripeCheckoutSession(
      { ...config, connectedAccountId: "acct_connected" },
      checkoutInput({ purpose: "BALANCE" }),
      async (request) => {
        captured = request;
        return { status: 200, body: JSON.stringify({ id: "cs_test_balance", url: "https://checkout.stripe.test/cs_test_balance" }) };
      },
    );

    expect(result.ok).toBe(true);
    const body = new URLSearchParams(captured?.body ?? "");
    expect(body.get("line_items[0][price_data][unit_amount]")).toBe("25500");
    expect(captured?.headers["stripe-account"]).toBe("acct_connected");
  });

  test("rejects scope mismatch and unsafe checkout URLs before provider call", async () => {
    let calls = 0;
    const http: StripeCheckoutHttpTransport = async () => {
      calls += 1;
      return { status: 200, body: "{}" };
    };

    const scoped = await createStripeCheckoutSession(config, checkoutInput({ hold: { holdId: "hold-1", workspaceId: "ws-other", quoteId: "quote-1", expiresAt: "2026-10-04T10:30:00.000Z" } }), http);
    const unsafe = await createStripeCheckoutSession(config, checkoutInput({ successUrl: "javascript:alert(1)" }), http);

    expect(scoped).toMatchObject({ ok: false, code: "CHECKOUT_SCOPE_MISMATCH" });
    expect(unsafe).toMatchObject({ ok: false, code: "PAYMENT_CHECKOUT_URL_INVALID" });
    expect(calls).toBe(0);
  });

  test("normalizes checkout provider failures without leaking secret key", async () => {
    const auth = await createStripeCheckoutSession(config, checkoutInput(), async () => ({ status: 401, body: JSON.stringify({ error: { message: "bad key" } }) }));
    const rate = await createStripeCheckoutSession(config, checkoutInput(), async () => ({ status: 429, body: JSON.stringify({ error: { message: "slow" } }) }));
    const server = await createStripeCheckoutSession(config, checkoutInput(), async () => ({ status: 503, body: JSON.stringify({ error: { message: "down" } }) }));

    expect(auth).toMatchObject({ ok: false, code: "PAYMENT_CONFIGURATION_BLOCKED" });
    expect(rate).toMatchObject({ ok: false, code: "PAYMENT_RATE_LIMITED" });
    expect(server).toMatchObject({ ok: false, code: "PAYMENT_TRANSIENT_FAILURE" });
    expect(JSON.stringify([auth, rate, server])).not.toContain("sk_test_secret");
  });
});
