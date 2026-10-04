import { describe, expect, test } from "vitest";
import { FixtureStripePaymentAdapter, signStripeFixturePayload } from "../../src/server/integrations/payments/adapter";
import { createPaymentWebhookApplicationStore } from "../../src/server/integrations/payments/core-application-bridge";
import { handleStripePaymentWebhook } from "../../src/server/api-handlers/provider-stripe";
import type { PaymentReviewItem, PaymentReviewStore } from "../../src/server/integrations/payments/review";
import type { VerifiedPaymentEvent, VerifiedPaymentApplicationOutcome } from "../../src/server/core/facade";
import type { Result } from "../../src/contracts";

const secret = "whsec_test_service_desk";
const providerAccountId = "acct_test_123";
const now = "2026-10-04T13:30:00.000Z";

function body(metadata: Record<string, string | undefined> = {}) {
  return JSON.stringify({
    id: "evt_test_deposit",
    account: providerAccountId,
    type: "checkout.session.completed",
    created: 1791110000,
    data: { object: { id: "cs_test_deposit", amount_total: 5000, currency: "usd", payment_intent: "pi_test_deposit", metadata: { workspaceId: "ws-clearnest", purpose: "DEPOSIT", quoteId: "quote-123", holdId: "hold-123", ...metadata } } },
  });
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
  async enqueuePaymentReview(item: PaymentReviewItem) {
    if (this.fail) throw new Error("review unavailable");
    this.items.push(item);
    return { reviewId: "review-1", state: "INSERTED" as const };
  }
}

describe("Stripe sandbox webhook Core bridge", () => {
  test("does not call Core on invalid signature", async () => {
    const adapter = new FixtureStripePaymentAdapter(secret, providerAccountId, () => now);
    const core = new CorePort({ ok: true, value: { state: "APPLIED" } });
    const result = await handleStripePaymentWebhook({ rawBody: body(), headers: { "stripe-signature": "bad" }, adapter, store: createPaymentWebhookApplicationStore(core) });
    expect(result).toMatchObject({ statusCode: 400, acknowledged: false, retryable: false });
    expect(core.calls).toHaveLength(0);
  });

  test("maps Core applied and duplicate outcomes without inventing out-of-order", async () => {
    const adapter = new FixtureStripePaymentAdapter(secret, providerAccountId, () => now);
    const rawBody = body();
    const headers = { "stripe-signature": signStripeFixturePayload(rawBody, secret, Math.floor(new Date(now).getTime() / 1000)) };
    const applied = await handleStripePaymentWebhook({ rawBody, headers, adapter, store: createPaymentWebhookApplicationStore(new CorePort({ ok: true, value: { state: "APPLIED" } })) });
    const duplicate = await handleStripePaymentWebhook({ rawBody, headers, adapter, store: createPaymentWebhookApplicationStore(new CorePort({ ok: true, value: { state: "DUPLICATE" } })) });
    expect(JSON.parse(applied.body ?? "{}").result).toBe("APPLIED");
    expect(JSON.parse(duplicate.body ?? "{}").result).toBe("DUPLICATE");
    expect(applied.body).not.toContain("OUT_OF_ORDER");
  });

  test("routes Core payment review durably before ACK", async () => {
    const adapter = new FixtureStripePaymentAdapter(secret, providerAccountId, () => now);
    const rawBody = body();
    const headers = { "stripe-signature": signStripeFixturePayload(rawBody, secret, Math.floor(new Date(now).getTime() / 1000)) };
    const reviewStore = new ReviewStore();
    const result = await handleStripePaymentWebhook({ rawBody, headers, adapter, store: createPaymentWebhookApplicationStore(new CorePort({ ok: true, value: { state: "PAYMENT_REVIEW" } })), review: { store: reviewStore } });
    expect(result).toMatchObject({ statusCode: 200, acknowledged: true, retryable: false });
    expect(reviewStore.items[0]).toMatchObject({ quoteId: "quote-123", holdId: "hold-123", canMutateBusinessTruth: false });
  });

  test("Core or review persistence failures remain retryable", async () => {
    const adapter = new FixtureStripePaymentAdapter(secret, providerAccountId, () => now);
    const rawBody = body();
    const headers = { "stripe-signature": signStripeFixturePayload(rawBody, secret, Math.floor(new Date(now).getTime() / 1000)) };
    const coreFailure = await handleStripePaymentWebhook({ rawBody, headers, adapter, store: createPaymentWebhookApplicationStore(new CorePort({ ok: false, code: "CORE_DB_UNAVAILABLE", message: "db unavailable" })) });
    const reviewStore = new ReviewStore();
    reviewStore.fail = true;
    const reviewFailure = await handleStripePaymentWebhook({ rawBody, headers, adapter, store: createPaymentWebhookApplicationStore(new CorePort({ ok: true, value: { state: "PAYMENT_REVIEW" } })), review: { store: reviewStore } });
    expect(coreFailure).toMatchObject({ statusCode: 503, acknowledged: false, retryable: true });
    expect(reviewFailure).toMatchObject({ statusCode: 503, acknowledged: false, retryable: true });
  });
});
