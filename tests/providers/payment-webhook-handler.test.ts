import { describe, expect, test } from "vitest";
import { handleStripePaymentWebhook, type PaymentWebhookApplicationStore } from "../../src/server/api-handlers/provider-stripe";
import { FixtureStripePaymentAdapter, signStripeFixturePayload } from "../../src/server/integrations/payments/adapter";

function succeededCheckoutRaw(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    id: "evt_payment_1",
    account: "acct_123",
    type: "checkout.session.completed",
    created: 1791108000,
    data: {
      object: {
        id: "cs_test_1234",
        amount_total: 8500,
        currency: "usd",
        payment_intent: "pi_1234",
        metadata: { workspaceId: "ws-clearnest", purpose: "DEPOSIT" },
      },
    },
    ...overrides,
  });
}

function store(result: "APPLIED" | "DUPLICATE" | "OUT_OF_ORDER_IGNORED" | "PAYMENT_REVIEW") {
  const calls: unknown[] = [];
  const applicationStore: PaymentWebhookApplicationStore = {
    async applyVerifiedPayment(input) {
      calls.push(input);
      return result;
    },
  };
  return { applicationStore, calls };
}

describe("Stripe payment webhook handler", () => {
  test("rejects invalid signatures before applying payment truth", async () => {
    const adapter = new FixtureStripePaymentAdapter("whsec_test", "acct_123", () => "2026-10-04T10:00:00.000Z");
    const rawBody = succeededCheckoutRaw();
    const state = store("APPLIED");

    const result = await handleStripePaymentWebhook({
      rawBody,
      headers: { "stripe-signature": signStripeFixturePayload(rawBody, "wrong", 1791108000) },
      adapter,
      store: state.applicationStore,
    });

    expect(result).toMatchObject({ statusCode: 400, acknowledged: false, retryable: false });
    expect(state.calls).toHaveLength(0);
  });

  test("rejects signed webhook replays outside the signature tolerance", async () => {
    const adapter = new FixtureStripePaymentAdapter("whsec_test", "acct_123", () => "2026-10-04T10:10:01.000Z");
    const rawBody = succeededCheckoutRaw();
    const state = store("APPLIED");

    const result = await handleStripePaymentWebhook({
      rawBody,
      headers: { "stripe-signature": signStripeFixturePayload(rawBody, "whsec_test", 1791108000) },
      adapter,
      store: state.applicationStore,
    });

    expect(result).toMatchObject({ statusCode: 400, acknowledged: false, retryable: false });
    expect(result.body).toContain("tolerance");
    expect(state.calls).toHaveLength(0);
  });

  test("rejects signed malformed JSON without throwing or touching payment truth", async () => {
    const adapter = new FixtureStripePaymentAdapter("whsec_test", "acct_123", () => "2026-10-04T10:00:00.000Z");
    const rawBody = "{not-json";
    const state = store("APPLIED");

    const result = await handleStripePaymentWebhook({
      rawBody,
      headers: { "stripe-signature": signStripeFixturePayload(rawBody, "whsec_test", 1791108000) },
      adapter,
      store: state.applicationStore,
    });

    expect(result).toMatchObject({ statusCode: 422, acknowledged: false, retryable: false });
    expect(result.body).toContain("malformed");
    expect(state.calls).toHaveLength(0);
  });

  test("applies a verified payment event exactly once through the store boundary", async () => {
    const adapter = new FixtureStripePaymentAdapter("whsec_test", "acct_123", () => "2026-10-04T10:00:00.000Z");
    const rawBody = succeededCheckoutRaw();
    const state = store("APPLIED");

    const result = await handleStripePaymentWebhook({
      rawBody,
      headers: { "stripe-signature": signStripeFixturePayload(rawBody, "whsec_test", 1791108000) },
      adapter,
      store: state.applicationStore,
    });

    expect(result).toMatchObject({ statusCode: 200, acknowledged: true, retryable: false });
    expect(JSON.parse(result.body ?? "{}")).toMatchObject({ result: "APPLIED", providerEventId: "evt_payment_1" });
    expect(state.calls).toHaveLength(1);
    expect(state.calls[0]).toMatchObject({
      event: expect.objectContaining({ providerEventId: "evt_payment_1", amountMinor: 8500, currency: "USD" }),
    });
  });

  test("acknowledges duplicate callbacks without duplicate business application", async () => {
    const adapter = new FixtureStripePaymentAdapter("whsec_test", "acct_123", () => "2026-10-04T10:00:00.000Z");
    const rawBody = succeededCheckoutRaw();
    const state = store("DUPLICATE");

    const result = await handleStripePaymentWebhook({
      rawBody,
      headers: { "stripe-signature": signStripeFixturePayload(rawBody, "whsec_test", 1791108000) },
      adapter,
      store: state.applicationStore,
    });

    expect(result).toMatchObject({ statusCode: 200, acknowledged: true, retryable: false });
    expect(JSON.parse(result.body ?? "{}")).toMatchObject({ result: "DUPLICATE" });
    expect(state.calls).toHaveLength(1);
  });

  test("acknowledges out-of-order callbacks without regressing later verified state", async () => {
    const adapter = new FixtureStripePaymentAdapter("whsec_test", "acct_123", () => "2026-10-04T10:00:00.000Z");
    const rawBody = succeededCheckoutRaw({ id: "evt_old" });
    const state = store("OUT_OF_ORDER_IGNORED");

    const result = await handleStripePaymentWebhook({
      rawBody,
      headers: { "stripe-signature": signStripeFixturePayload(rawBody, "whsec_test", 1791108000) },
      adapter,
      store: state.applicationStore,
    });

    expect(result).toMatchObject({ statusCode: 200, acknowledged: true, retryable: false });
    expect(JSON.parse(result.body ?? "{}")).toMatchObject({ result: "OUT_OF_ORDER_IGNORED" });
  });

  test("does not acknowledge when durable application fails", async () => {
    const adapter = new FixtureStripePaymentAdapter("whsec_test", "acct_123", () => "2026-10-04T10:00:00.000Z");
    const rawBody = succeededCheckoutRaw();
    const applicationStore: PaymentWebhookApplicationStore = {
      async applyVerifiedPayment() {
        throw new Error("database unavailable");
      },
    };

    const result = await handleStripePaymentWebhook({
      rawBody,
      headers: { "stripe-signature": signStripeFixturePayload(rawBody, "whsec_test", 1791108000) },
      adapter,
      store: applicationStore,
    });

    expect(result).toMatchObject({ statusCode: 503, acknowledged: false, retryable: true });
  });
});
