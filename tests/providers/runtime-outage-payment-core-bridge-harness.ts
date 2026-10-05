import assert from "node:assert/strict";
import { FixtureStripePaymentAdapter, signStripeFixturePayload } from "../../src/server/integrations/payments/adapter";
import { createStripeCheckoutSession } from "../../src/server/integrations/payments/stripe-checkout";
import { createPaymentWebhookApplicationStore } from "../../src/server/integrations/payments/core-application-bridge";
import { handleStripePaymentWebhook } from "../../src/server/api-handlers/provider-stripe";
import type { VerifiedPaymentEvent, VerifiedPaymentApplicationOutcome } from "../../src/server/core/facade";
import type { Result, QuoteDTO } from "../../src/contracts";
import type { PaymentReviewItem, PaymentReviewStore } from "../../src/server/integrations/payments/review";

const secret = "whsec_test_service_desk";
const providerAccountId = "acct_test_123";
const now = "2026-10-04T13:30:00.000Z";
const adapter = new FixtureStripePaymentAdapter(secret, providerAccountId, () => now);

function payload(purpose: "DEPOSIT" | "BALANCE" | "PLATFORM_SUBSCRIPTION", metadata: Record<string, string | undefined>, overrides: Partial<{ amount: number; id: string; objectId: string; pi: string }> = {}): string {
  return JSON.stringify({
    id: overrides.id ?? `evt_test_${purpose.toLowerCase()}`,
    account: providerAccountId,
    type: "checkout.session.completed",
    created: 1791110000,
    data: { object: { id: overrides.objectId ?? `cs_test_${purpose.toLowerCase()}`, amount_total: overrides.amount ?? 5000, currency: "usd", payment_intent: overrides.pi ?? `pi_test_${purpose.toLowerCase()}`, metadata: { workspaceId: "ws-clearnest", purpose, ...metadata } } },
  });
}

function signature(rawBody: string): string {
  return signStripeFixturePayload(rawBody, secret, Math.floor(new Date(now).getTime() / 1000));
}

class CorePort {
  calls: VerifiedPaymentEvent[] = [];
  constructor(private readonly outcome: Result<VerifiedPaymentApplicationOutcome>) {}
  async applyVerifiedPayment(event: VerifiedPaymentEvent): Promise<Result<VerifiedPaymentApplicationOutcome>> {
    this.calls.push(event);
    return this.outcome;
  }
}

class ReviewStore implements PaymentReviewStore {
  items: PaymentReviewItem[] = [];
  fail = false;
  async enqueuePaymentReview(item: PaymentReviewItem): Promise<{ reviewId: string; state: "INSERTED" | "DUPLICATE" }> {
    if (this.fail) throw new Error("review db unavailable");
    this.items.push(item);
    return { reviewId: `review-${this.items.length}`, state: "INSERTED" };
  }
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

async function main(): Promise<void> {
  const depositRaw = payload("DEPOSIT", { quoteId: "quote-123", holdId: "hold-123" });
  const depositVerified = await adapter.verifyWebhook(depositRaw, { "stripe-signature": signature(depositRaw) });
  assert.equal(depositVerified.ok, true);
  if (depositVerified.ok) {
    assert.equal(depositVerified.value.event.quoteId, "quote-123");
    assert.equal(depositVerified.value.event.holdId, "hold-123");
    assert.equal(depositVerified.value.evidence.mode, "SANDBOX");
    assert.equal(depositVerified.value.evidence.verification, "CONTRACT_TESTED");
  }

  const balanceRaw = payload("BALANCE", { invoiceId: "invoice-456" }, { amount: 15000, id: "evt_test_balance", objectId: "cs_test_balance", pi: "pi_test_balance" });
  const balanceVerified = await adapter.verifyWebhook(balanceRaw, { "stripe-signature": signature(balanceRaw) });
  assert.equal(balanceVerified.ok, true);
  if (balanceVerified.ok) assert.equal(balanceVerified.value.event.invoiceId, "invoice-456");

  const missingDepositRaw = payload("DEPOSIT", { quoteId: "quote-123" });
  const missingDepositVerified = await adapter.verifyWebhook(missingDepositRaw, { "stripe-signature": signature(missingDepositRaw) });
  assert.equal(missingDepositVerified.ok, false);
  if (!missingDepositVerified.ok) assert.equal(missingDepositVerified.code, "PAYMENT_BOOKING_REFERENCE_MISSING");

  const missingBalanceRaw = payload("BALANCE", {});
  const missingBalanceVerified = await adapter.verifyWebhook(missingBalanceRaw, { "stripe-signature": signature(missingBalanceRaw) });
  assert.equal(missingBalanceVerified.ok, false);
  if (!missingBalanceVerified.ok) assert.equal(missingBalanceVerified.code, "PAYMENT_INVOICE_REFERENCE_MISSING");

  const fixtureCheckout = await adapter.createCheckout({ quote, purpose: "BALANCE", invoiceId: "invoice-456", balanceMinor: 15000, successUrl: "https://example.com/s", cancelUrl: "https://example.com/c" });
  assert.equal(fixtureCheckout.ok, true);
  if (fixtureCheckout.ok) assert.equal(fixtureCheckout.value.metadata?.invoiceId, "invoice-456");

  let capturedBody = "";
  const stripeCheckout = await createStripeCheckoutSession(
    { apiBaseUrl: "https://api.stripe.test/v1", secretKey: "sk_test_x", providerAccountId, mode: "SANDBOX", now: () => now },
    { quote, purpose: "BALANCE", invoiceId: "invoice-456", balanceMinor: 15000, successUrl: "https://example.com/s", cancelUrl: "https://example.com/c" },
    async (request) => { capturedBody = request.body; return { status: 200, body: JSON.stringify({ id: "cs_test_123", url: "https://checkout.stripe.test/cs_test_123" }) }; },
  );
  assert.equal(stripeCheckout.ok, true);
  assert.match(capturedBody, /metadata%5BinvoiceId%5D=invoice-456/);

  const appliedCore = new CorePort({ ok: true, value: { state: "APPLIED", invoice: { id: "invoice-456" } as any } });
  const applied = await handleStripePaymentWebhook({ rawBody: balanceRaw, headers: { "stripe-signature": signature(balanceRaw) }, adapter, store: createPaymentWebhookApplicationStore(appliedCore) });
  assert.equal(applied.statusCode, 200);
  assert.equal(applied.acknowledged, true);
  assert.equal(appliedCore.calls[0].invoiceId, "invoice-456");
  assert.equal(JSON.parse(applied.body ?? "{}").result, "APPLIED");

  const duplicate = await handleStripePaymentWebhook({ rawBody: balanceRaw, headers: { "stripe-signature": signature(balanceRaw) }, adapter, store: createPaymentWebhookApplicationStore(new CorePort({ ok: true, value: { state: "DUPLICATE" } })) });
  assert.equal(JSON.parse(duplicate.body ?? "{}").result, "DUPLICATE");

  const reviewStore = new ReviewStore();
  const review = await handleStripePaymentWebhook({ rawBody: depositRaw, headers: { "stripe-signature": signature(depositRaw) }, adapter, store: createPaymentWebhookApplicationStore(new CorePort({ ok: true, value: { state: "PAYMENT_REVIEW", attentionItemId: "attn-1" } })), review: { store: reviewStore } });
  assert.equal(review.statusCode, 200);
  assert.equal(reviewStore.items[0].quoteId, "quote-123");
  assert.equal(reviewStore.items[0].holdId, "hold-123");
  assert.equal(reviewStore.items[0].providerTransactionRef.includes("pi_test_deposit"), false);

  const invalidCore = new CorePort({ ok: true, value: { state: "APPLIED" } });
  const invalid = await handleStripePaymentWebhook({ rawBody: depositRaw, headers: { "stripe-signature": "bad" }, adapter, store: createPaymentWebhookApplicationStore(invalidCore) });
  assert.equal(invalid.statusCode, 400);
  assert.equal(invalidCore.calls.length, 0);

  const coreFailure = await handleStripePaymentWebhook({ rawBody: depositRaw, headers: { "stripe-signature": signature(depositRaw) }, adapter, store: createPaymentWebhookApplicationStore(new CorePort({ ok: false, code: "CORE_DB_UNAVAILABLE", message: "db unavailable" })) });
  assert.equal(coreFailure.statusCode, 503);
  assert.equal(coreFailure.retryable, true);
  assert.equal(coreFailure.acknowledged, false);

  const failingReviewStore = new ReviewStore();
  failingReviewStore.fail = true;
  const reviewFailure = await handleStripePaymentWebhook({ rawBody: depositRaw, headers: { "stripe-signature": signature(depositRaw) }, adapter, store: createPaymentWebhookApplicationStore(new CorePort({ ok: true, value: { state: "PAYMENT_REVIEW" } })), review: { store: failingReviewStore } });
  assert.equal(reviewFailure.statusCode, 503);
  assert.equal(reviewFailure.retryable, true);
  assert.equal(reviewFailure.acknowledged, false);

  console.log("runtime-outage-payment-core-bridge-harness PASS");
}

void main();