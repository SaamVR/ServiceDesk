import { createHmac } from "node:crypto";
import { describe, expect, test } from "vitest";
import { FixtureStripePaymentAdapter, signStripeFixturePayload, verifyStripeSignature } from "../../src/server/integrations/payments/adapter";

function rawSucceededCheckout(overrides: Record<string, unknown> = {}): string {
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
        metadata: { workspaceId: "ws-clearnest", purpose: "DEPOSIT", quoteId: "quote-1", holdId: "hold-1" },
      },
    },
    ...overrides,
  });
}

function sign(rawBody: string, secret: string, timestamp: number): string {
  return createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
}

describe("Stripe webhook cryptographic hardening", () => {
  test("accepts any valid v1 signature among multiple signatures", () => {
    const rawBody = rawSucceededCheckout();
    const timestamp = 1791108000;
    const valid = sign(rawBody, "whsec_test", timestamp);
    const result = verifyStripeSignature(
      rawBody,
      `t=${timestamp},v1=0000000000000000000000000000000000000000000000000000000000000000,v1=${valid}`,
      "whsec_test",
      { nowSeconds: timestamp + 60, toleranceSeconds: 300 },
    );

    expect(result).toEqual({ ok: true, value: true });
  });

  test("rejects malformed multi-signature headers and stale replays", () => {
    const rawBody = rawSucceededCheckout();
    const stale = verifyStripeSignature(rawBody, signStripeFixturePayload(rawBody, "whsec_test", 1791108000), "whsec_test", {
      nowSeconds: 1791108401,
      toleranceSeconds: 300,
    });
    const malformed = verifyStripeSignature(rawBody, "t=1791108000,v1=not-hex", "whsec_test", { nowSeconds: 1791108000 });

    expect(stale).toMatchObject({ ok: false, code: "SIGNATURE_TIMESTAMP_OUT_OF_TOLERANCE" });
    expect(malformed).toMatchObject({ ok: false, code: "MALFORMED_SIGNATURE" });
  });

  test("rejects signed events with invalid purpose metadata before conversion", async () => {
    const adapter = new FixtureStripePaymentAdapter("whsec_test", "acct_123", () => "2026-10-04T10:00:00.000Z");
    const rawBody = rawSucceededCheckout({
      data: {
        object: {
          id: "cs_test_1234",
          amount_total: 8500,
          currency: "usd",
          payment_intent: "pi_1234",
          metadata: { workspaceId: "ws-clearnest", purpose: "OVERRIDE_PRICE" },
        },
      },
    });

    const result = await adapter.verifyWebhook(rawBody, { "stripe-signature": signStripeFixturePayload(rawBody, "whsec_test", 1791108000) });

    expect(result).toMatchObject({ ok: false, code: "PAYMENT_PURPOSE_INVALID" });
  });

  test("rejects signed events with non-positive amount or missing transaction reference", async () => {
    const adapter = new FixtureStripePaymentAdapter("whsec_test", "acct_123", () => "2026-10-04T10:00:00.000Z");
    const zeroAmount = rawSucceededCheckout({
      data: {
        object: {
          id: "cs_test_zero",
          amount_total: 0,
          currency: "usd",
          payment_intent: "pi_zero",
          metadata: { workspaceId: "ws-clearnest", purpose: "DEPOSIT", quoteId: "quote-1", holdId: "hold-1" },
        },
      },
    });
    const missingTransaction = rawSucceededCheckout({
      data: {
        object: {
          id: "cs_test_missing_pi",
          amount_total: 8500,
          currency: "usd",
          metadata: { workspaceId: "ws-clearnest", purpose: "DEPOSIT", quoteId: "quote-1", holdId: "hold-1" },
        },
      },
    });

    const zero = await adapter.verifyWebhook(zeroAmount, { "stripe-signature": signStripeFixturePayload(zeroAmount, "whsec_test", 1791108000) });
    const missing = await adapter.verifyWebhook(missingTransaction, { "stripe-signature": signStripeFixturePayload(missingTransaction, "whsec_test", 1791108000) });

    expect(zero).toMatchObject({ ok: false, code: "PAYMENT_AMOUNT_INVALID" });
    expect(missing).toMatchObject({ ok: false, code: "PAYMENT_TRANSACTION_MISSING" });
  });

  test("converts only signed validated event shape into VerifiedPaymentWebhook", async () => {
    const adapter = new FixtureStripePaymentAdapter("whsec_test", "acct_123", () => "2026-10-04T10:00:00.000Z");
    const rawBody = rawSucceededCheckout();

    const result = await adapter.verifyWebhook(rawBody, { "stripe-signature": signStripeFixturePayload(rawBody, "whsec_test", 1791108000) });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.event).toEqual({
        provider: "STRIPE",
        providerAccountId: "acct_123",
        providerEventId: "evt_payment_1",
        providerTransactionId: "pi_1234",
        purpose: "DEPOSIT",
        workspaceId: "ws-clearnest",
        amountMinor: 8500,
        currency: "USD",
        occurredAt: "2026-10-04T10:00:00.000Z",
        quoteId: "quote-1",
        holdId: "hold-1",
      });
      expect(result.value.evidence.verification).toBe("CONTRACT_TESTED");
      expect(JSON.stringify(result.value.evidence)).not.toContain("whsec_test");
      expect(JSON.stringify(result.value.evidence)).not.toContain(rawBody);
    }
  });
});
