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
  test("refuses oversized or invalid successful checkout response before accepting a session", async () => {
    const oversized = JSON.stringify({
      id: "cs_test_valid", url: "https://checkout.stripe.com/session/cs_test_valid",
      ignored: "x".repeat(17000),
    });
    for (const response of [
      oversized,
      JSON.stringify({ id: "cs_test_" + "a".repeat(520),
        url: "https://checkout.stripe.com/session/cs_test_valid" }),
      "  ",
      "null",
    ]) {
      let calls = 0;
      const result = await createStripeCheckoutSession(input(), config, async () => {
        calls++;
        return { status: 200, body: response };
      });
      expect(calls).toBe(1);
      expect(result).toMatchObject({ ok: false, code: "PAYMENT_PROVIDER_RESPONSE_INVALID" });
      expect(JSON.stringify(result)).not.toContain("x".repeat(100));
    }
  });

  test("creates a hosted checkout session from server-derived deposit amount only", async () => {
    let captured: Parameters<StripeCheckoutHttpTransport>[0] | undefined;
    const result = await createStripeCheckoutSession(input(), config, async (request) => {
      captured = request;
      return {
        status: 200,
        body: JSON.stringify({ id: "cs_test_123", url: "https://checkout.stripe.com/session/cs_test_123" }),
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
        checkoutUrl: "https://checkout.stripe.com/session/cs_test_123",
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

  test.each([
    { successUrl: "https://other.example/success" },
    { cancelUrl: "https://other.example/cancel" },
    { successUrl: "https://alice:password@app.servicedesk.test/success" },
    { successUrl: "https://app.servicedesk.test:8443/success" },
    { successUrl: "https://app.servicedesk.test/success#secret" },
    { cancelUrl: "https://127.0.0.1/cancel" },
    { successUrl: "https://localhost/success" },
    { cancelUrl: " https://app.servicedesk.test/cancel" },
  ])("fails before contacting Stripe for unsafe or cross-origin return URLs: %j", async url => {
    let calls = 0;
    const result = await createStripeCheckoutSession(input(url), config,
      async () => { calls++; return { status: 200, body: "{}" }; });
    expect(result).toMatchObject({ ok: false, code: "CHECKOUT_REDIRECT_URL_INVALID" });
    expect(calls).toBe(0);
  });

  test("permits distinct HTTPS paths and query parameters on one application origin", async () => {
    let body = "";
    const result = await createStripeCheckoutSession(input({
      successUrl: "https://app.servicedesk.test/payment/success?session={CHECKOUT_SESSION_ID}",
      cancelUrl: "https://app.servicedesk.test/payment/cancel?retry=1",
    }), config, async request => {
      body = request.body;
      return { status: 200, body: JSON.stringify({
        id: "cs_test_123", url: "https://checkout.stripe.com/c/pay/123",
      }) };
    });
    expect(result.ok).toBe(true);
    const posted = new URLSearchParams(body);
    expect(posted.get("success_url")).toContain("payment/success");
    expect(posted.get("cancel_url")).toContain("payment/cancel");
  });

  test.each([
    { id: "cs_test_123", url: "https://attacker.example/checkout" },
    { id: "cs_test_123", url: "https://checkout.stripe.com.attacker.org/session/123" },
    { id: "cs_test_123", url: "https://someone:secret@checkout.stripe.com/session/123" },
    { id: "cs_test_123", url: "https://checkout.stripe.com:8443/session/123" },
    { id: "cs_test_123", url: "https://checkout.stripe.com/session/123#fragment" },
    { id: "cs_test_123", url: "http://checkout.stripe.com/session/123" },
    { id: "fake_123", url: "https://checkout.stripe.com/session/123" },
  ])("rejects unverified hosted-checkout destination: %j", async ({ id, url }) => {
    const result = await createStripeCheckoutSession(input(), config, async () => ({
      status: 200, body: JSON.stringify({ id, url }),
    }));
    expect(result).toMatchObject({ ok: false, code: "PAYMENT_PROVIDER_RESPONSE_INVALID" });
    expect(JSON.stringify(result)).not.toContain("sk_test_secret_value");
  });

  test("sandbox cannot return a real-money checkout session even from Stripe's host", async () => {
    const result = await createStripeCheckoutSession(input(), config, async () => ({
      status: 200,
      body: JSON.stringify({ id: "cs_live_123", url: "https://checkout.stripe.com/c/pay/123" }),
    }));
    expect(result).toMatchObject({ ok: false, code: "PAYMENT_PROVIDER_RESPONSE_INVALID" });
  });

  test.each([
    { apiBaseUrl: "https://attacker.example", secretKey: "sk_test_not_real" },
    { apiBaseUrl: "https://api.stripe.com.attacker.org", secretKey: "sk_test_not_real" },
    { apiBaseUrl: "https://someone:secret@api.stripe.com", secretKey: "sk_test_not_real" },
    { apiBaseUrl: "https://api.stripe.com:8443", secretKey: "sk_test_not_real" },
    { apiBaseUrl: "http://api.stripe.com", secretKey: "sk_test_not_real" },
    { apiBaseUrl: "https://api.stripe.com", secretKey: "sk_live_unsafe_real_key" },
  ])("never sends Stripe authorization to wrong origin or with live key in sandbox: %j",
    async ({ apiBaseUrl, secretKey }) => {
      let called = 0;
      const result = await createStripeCheckoutSession(input(), { ...config, apiBaseUrl, secretKey },
        async () => { called++; return { status: 200, body: "{}" }; });
      expect(result).toMatchObject({ ok: false, code: "PAYMENT_CONFIGURATION_BLOCKED" });
      expect(called).toBe(0);
      expect(JSON.stringify(result)).not.toContain(secretKey);
    },
  );

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
  test("rejects expired and malformed authoritative deposit holds without contacting Stripe", async () => {
    let calls = 0;
    const transport: StripeCheckoutHttpTransport = async () => {
      calls++;
      return { status: 200, body: "{}" };
    };
    for (const expiresAt of ["2026-10-04T12:00:00.000Z", "2026-10-03T12:00:00.000Z"]) {
      const result = await createStripeCheckoutSession(input({
        hold: { holdId: "hold-1", workspaceId: "ws-clearnest", quoteId: "quote-1", expiresAt },
      }), config, transport);
      expect(result).toMatchObject({ ok: false, code: "PAYMENT_HOLD_EXPIRED" });
    }
    const invalid = await createStripeCheckoutSession(input({
      hold: { holdId: "hold-1", workspaceId: "ws-clearnest", quoteId: "quote-1", expiresAt: "invalid" },
    }), config, transport);
    expect(invalid).toMatchObject({ ok: false, code: "PAYMENT_HOLD_EXPIRY_INVALID" });
    expect(calls).toBe(0);
  });

  test("treats null and array HTTP-200 checkout receipts as invalid contracts", async () => {
    for (const body of ["null", "[]", "1", "true", "\"\""]) {
      const result = await createStripeCheckoutSession(input(), config,
        async () => ({ status: 200, body }));
      expect(result).toMatchObject({ ok: false, code: "PAYMENT_PROVIDER_RESPONSE_INVALID" });
    }
  });

});
