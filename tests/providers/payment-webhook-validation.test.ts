import { describe, expect, test } from "vitest";
import { FixtureStripePaymentAdapter, signStripeFixturePayload } from "../../src/server/integrations/payments/adapter";

function raw(payload: Record<string, unknown>): string {
  return JSON.stringify({
    id: "evt_payment_validation",
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
    ...payload,
  });
}

function adapter() {
  return new FixtureStripePaymentAdapter("whsec_test", "acct_123", () => "2026-10-04T10:00:00.000Z");
}

async function verify(rawBody: string) {
  return adapter().verifyWebhook(rawBody, { "stripe-signature": signStripeFixturePayload(rawBody, "whsec_test", 1791108000) });
}

describe("payment webhook validation", () => {
  test("rejects webhook from another payment account before payment truth application", async () => {
    const result = await verify(raw({ account: "acct_other" }));
    expect(result).toMatchObject({ ok: false, code: "PAYMENT_ACCOUNT_MISMATCH" });
  });

  test("rejects missing workspace, purpose, amount, currency, and transaction references", async () => {
    expect(await verify(raw({ data: { object: { id: "cs", amount_total: 8500, currency: "usd", payment_intent: "pi", metadata: { purpose: "DEPOSIT" } } } }))).toMatchObject({ ok: false, code: "PAYMENT_METADATA_MISSING" });
    expect(await verify(raw({ data: { object: { id: "cs", amount_total: 8500, currency: "usd", payment_intent: "pi", metadata: { workspaceId: "ws-clearnest", purpose: "TIP" } } } }))).toMatchObject({ ok: false, code: "PAYMENT_PURPOSE_INVALID" });
    expect(await verify(raw({ data: { object: { id: "cs", amount_total: 0, currency: "usd", payment_intent: "pi", metadata: { workspaceId: "ws-clearnest", purpose: "DEPOSIT" } } } }))).toMatchObject({ ok: false, code: "PAYMENT_AMOUNT_INVALID" });
    expect(await verify(raw({ data: { object: { id: "cs", amount_total: 8500, currency: "", payment_intent: "pi", metadata: { workspaceId: "ws-clearnest", purpose: "DEPOSIT" } } } }))).toMatchObject({ ok: false, code: "PAYMENT_PAYLOAD_INVALID" });
    expect(await verify(raw({ data: { object: { id: "cs", amount_total: 8500, currency: "usd", metadata: { workspaceId: "ws-clearnest", purpose: "DEPOSIT", quoteId: "quote-1", holdId: "hold-1" } } } }))).toMatchObject({ ok: false, code: "PAYMENT_TRANSACTION_MISSING" });
  });

  test("ignores failed payment events without converting them into payment truth", async () => {
    const result = await verify(raw({ type: "payment_intent.payment_failed" }));
    expect(result).toMatchObject({ ok: false, code: "PAYMENT_EVENT_IGNORED" });
  });
});
