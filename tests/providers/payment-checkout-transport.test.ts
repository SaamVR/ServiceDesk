import { describe, expect, test } from "vitest";
import type { CheckoutInput } from "../../src/server/integrations/types";
import { createStripeCheckoutSession, type StripeCheckoutHttpTransport } from "../../src/server/integrations/payments/checkout-transport";

const quote = {
  id: "quote-1",
  workspaceId: "ws-clearnest",
  requestId: "req-1",
  version: 1,
  status: "APPROVED" as const,
  currency: "USD" as const,
  subtotalMinor: 34000,
  taxMinor: 0,
  totalMinor: 34000,
  depositMinor: 8500,
  balanceMinor: 25500,
  durationMinutes: 240,
  bufferMinutes: 30,
  rateVersion: "v1",
  validUntil: "2026-10-05T12:00:00.000Z",
};

function input(overrides: Partial<CheckoutInput> = {}): CheckoutInput {
  return {
    hold: { holdId: "hold-1", workspaceId: "ws-clearnest", quoteId: "quote-1", expiresAt: "2026-10-04T13:00:00.000Z" },
    quote,
    purpose: "DEPOSIT",
    successUrl: "https://app.servicedesk.test/checkout/success",
    cancelUrl: "https://app.servicedesk.test/checkout/cancel",
    ...overrides,
  };
}

const config = {
  apiBaseUrl: "https://api.stripe.com",
  secretKey: "sk_test_secret_value",
  mode: "SANDBOX" as const,
  connectedAccountId: "acct_connected_1",
  now: () => "2026-10-04T12:00:00.000Z",
};

describe("Stripe-style checkout transport", () => {
  test("creates a hosted checkout session from server-derived deposit amount only", async () => {
    let captured: Parameters<StripeCheckoutHttpTransport>[0] | undefined;
    const result = await createStripeCheckoutSession(input(), config, async (request) => {
      captured = request;
      return {
        status: 200,
        body: JSON.stringify({ id: "cs_test_123", url: "https://checkout.stripe.test/session/cs_test_123" }),
      };
    });

    expect(result.ok).toBe(true);
    expect(captured?.url).toBe("https://api.stripe.com/v1/checkout/sessions");
    expect(captured?.method).toBe("POST");
    expect(captured?.headers.authorization).toBe("Bearer sk_test_secret_value");
    expect(captured?.headers["idempotency-key"]).toBe("checkout:ws-clearnest:hold-1:DEPOSIT");
    expect(captured?.headers["stripe-account"]).toBe("acct_connected_1");

    const body = new URLSearchParams(captured?.body ?? "");
    expect(body.get("line_items[0][price_data][unit_amount]")).toBe("8500");
    expect(body.get("line_items[0][price_data][currency]")).toBe("usd");
    expect(body.get("metadata[workspaceId]")).toBe("ws-clearnest");
    expect(body.get("metadata[quoteId]")).toBe("quote-1");
    expect(body.get("metadata[holdId]")).toBe("hold-1");
    expect(body.get("metadata[purpose]")).toBe("DEPOSIT");
    expect(body.get("success_url")).toBe("https://app.servicedesk.test/checkout/success");

    if (result.ok) {
      expect(result.value).toMatchObject({
        provider: "STRIPE",
        providerSessionId: "cs_test_123",
        checkoutUrl: "https://checkout.stripe.test/session/cs_test_123",
        amountMinor: 8500,
        currency: "USD",
        mode: "SANDBOX",
      });
      expect(JSON.stringify(result.value.evidence)).not.toContain("sk_test_secret_value");
    }
  });

  test("rejects client-scope mismatches and unsafe redirect URLs before provider call", async () => {
    const calls: unknown[] = [];
    const mismatch = await createStripeCheckoutSession(
      input({ hold: { holdId: "hold-1", workspaceId: "ws-other", quoteId: "quote-1", expiresAt: "2026-10-04T13:00:00.000Z" } }),
      config,
      async (request) => {
        calls.push(request);
        return { status: 200, body: "{}" };
      },
    );
    const badUrl = await createStripeCheckoutSession(input({ successUrl: "javascript:alert(1)" }), config, async (request) => {
      calls.push(request);
      return { status: 200, body: "{}" };
    });

    expect(mismatch).toMatchObject({ ok: false, code: "CHECKOUT_SCOPE_MISMATCH" });
    expect(badUrl).toMatchObject({ ok: false, code: "CHECKOUT_REDIRECT_URL_INVALID" });
    expect(calls).toHaveLength(0);
  });

  test("normalizes provider auth, rate-limit, invalid request, timeout, and malformed success response", async () => {
    await expect(createStripeCheckoutSession(input(), config, async () => ({ status: 401, body: "{}" }))).resolves.toMatchObject({ ok: false, code: "PAYMENT_CONFIGURATION_BLOCKED" });
    await expect(createStripeCheckoutSession(input(), config, async () => ({ status: 429, body: "{}" }))).resolves.toMatchObject({ ok: false, code: "PAYMENT_RATE_LIMITED" });
    await expect(createStripeCheckoutSession(input(), config, async () => ({ status: 400, body: "{}" }))).resolves.toMatchObject({ ok: false, code: "PAYMENT_INVALID_REQUEST" });
    await expect(createStripeCheckoutSession(input(), config, async () => ({ status: 200, body: JSON.stringify({ id: "cs_missing_url" }) }))).resolves.toMatchObject({ ok: false, code: "PAYMENT_PROVIDER_RESPONSE_INVALID" });
    await expect(createStripeCheckoutSession(input(), config, async () => {
      const error = new Error("timed out");
      error.name = "AbortError";
      throw error;
    })).resolves.toMatchObject({ ok: false, code: "PAYMENT_PROVIDER_TIMEOUT" });
  });
});
