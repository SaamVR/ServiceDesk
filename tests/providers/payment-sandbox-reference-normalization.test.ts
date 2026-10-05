import { describe, expect, test } from "vitest";
import { FixtureStripePaymentAdapter, signStripeFixturePayload } from "../../src/server/integrations/payments/adapter";
import { createStripeCheckoutSession } from "../../src/server/integrations/payments/stripe-checkout";
import type { QuoteDTO } from "../../src/contracts";

const secret = "whsec_test_service_desk";
const providerAccountId = "acct_test_123";
const now = "2026-10-04T13:30:00.000Z";

function signed(rawBody: string) {
  return { "stripe-signature": signStripeFixturePayload(rawBody, secret, Math.floor(new Date(now).getTime() / 1000)) };
}

function webhook(purpose: string, metadata: Record<string, string | undefined>) {
  return JSON.stringify({
    id: `evt_test_${purpose.toLowerCase()}`,
    account: providerAccountId,
    type: "checkout.session.completed",
    created: 1791110000,
    data: { object: { id: `cs_test_${purpose.toLowerCase()}`, amount_total: 5000, currency: "usd", payment_intent: `pi_test_${purpose.toLowerCase()}`, metadata: { workspaceId: "ws-clearnest", purpose, ...metadata } } },
  });
}

const quote: QuoteDTO = {
  id: "quote-123",
  workspaceId: "ws-clearnest",
  requestId: "req-123",
  version: 1,
  status: "ACCEPTED",
  currency: "USD",
  subtotalMinor: 20000,
  taxMinor: 0,
  depositMinor: 5000,
  balanceMinor: 15000,
  totalMinor: 20000,
  durationMinutes: 120,
  bufferMinutes: 30,
  rateVersion: "fixture-v1",
  validUntil: "2026-10-05T00:00:00.000Z",
};
const hold = { holdId: "hold-123", workspaceId: "ws-clearnest", quoteId: "quote-123", expiresAt: "2026-10-05T00:00:00.000Z" };

describe("Stripe sandbox payment reference normalization", () => {
  test("requires quoteId and holdId for deposit webhooks", async () => {
    const adapter = new FixtureStripePaymentAdapter(secret, providerAccountId, () => now);
    const valid = webhook("DEPOSIT", { quoteId: "quote-123", holdId: "hold-123" });
    const missing = webhook("DEPOSIT", { quoteId: "quote-123" });
    const verified = await adapter.verifyWebhook(valid, signed(valid));
    const rejected = await adapter.verifyWebhook(missing, signed(missing));
    expect(verified.ok).toBe(true);
    if (verified.ok) expect(verified.value.event).toMatchObject({ quoteId: "quote-123", holdId: "hold-123" });
    expect(rejected).toMatchObject({ ok: false, code: "PAYMENT_BOOKING_REFERENCE_MISSING" });
  });

  test("requires invoiceId for balance webhooks and checkouts", async () => {
    const adapter = new FixtureStripePaymentAdapter(secret, providerAccountId, () => now);
    const valid = webhook("BALANCE", { invoiceId: "invoice-456" });
    const missing = webhook("BALANCE", {});
    const verified = await adapter.verifyWebhook(valid, signed(valid));
    const rejected = await adapter.verifyWebhook(missing, signed(missing));
    expect(verified.ok).toBe(true);
    if (verified.ok) expect(verified.value.event.invoiceId).toBe("invoice-456");
    expect(rejected).toMatchObject({ ok: false, code: "PAYMENT_INVOICE_REFERENCE_MISSING" });
    await expect(adapter.createCheckout({ quote, purpose: "BALANCE", balanceMinor: 15000, successUrl: "https://example.com/s", cancelUrl: "https://example.com/c" })).resolves.toMatchObject({ ok: false, code: "PAYMENT_INVOICE_REFERENCE_MISSING" });
  });

  test("carries balance invoice metadata through Stripe-style checkout request", async () => {
    let body = "";
    const result = await createStripeCheckoutSession(
      { apiBaseUrl: "https://api.stripe.test/v1", secretKey: "sk_test_x", providerAccountId, mode: "SANDBOX", now: () => now },
      { quote, purpose: "BALANCE", invoiceId: "invoice-456", balanceMinor: 9200, successUrl: "https://example.com/s", cancelUrl: "https://example.com/c" },
      async (request) => { body = request.body; return { status: 200, body: JSON.stringify({ id: "cs_test_123", url: "https://checkout.stripe.test/cs_test_123" }) }; },
    );
    expect(result.ok).toBe(true);
    expect(body).toContain("metadata%5BinvoiceId%5D=invoice-456");
    expect(body).not.toContain("metadata%5BholdId%5D");
    expect(body).toContain("line_items%5B0%5D%5Bprice_data%5D%5Bunit_amount%5D=9200");
    if (result.ok) expect(result.value.metadata?.invoiceId).toBe("invoice-456");
  });
});