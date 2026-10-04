import { describe, expect, test } from "vitest";
import { classifyStripePaymentLifecycle, type StripePaymentLifecyclePayload } from "../../src/server/integrations/payments/lifecycle";

function payload(overrides: Partial<StripePaymentLifecyclePayload> = {}): StripePaymentLifecyclePayload {
  return {
    id: "evt_123",
    account: "acct_123",
    type: "checkout.session.completed",
    created: 1791108000,
    data: {
      object: {
        id: "cs_123",
        amount_total: 8500,
        currency: "usd",
        payment_intent: "pi_123",
        metadata: { workspaceId: "ws-clearnest", purpose: "DEPOSIT" },
      },
    },
    ...overrides,
  };
}

describe("payment lifecycle matrix", () => {
  test("routes successful checkout and payment intent events to verified payment application", () => {
    expect(classifyStripePaymentLifecycle(payload(), "acct_123")).toMatchObject({ ok: true, value: { action: "APPLY_VERIFIED_PAYMENT", terminal: false, canMutateBusinessTruth: false } });
    expect(classifyStripePaymentLifecycle(payload({ type: "payment_intent.succeeded" }), "acct_123")).toMatchObject({ ok: true, value: { action: "APPLY_VERIFIED_PAYMENT" } });
  });

  test("routes failed payment and expired checkout to non-mutating review states", () => {
    expect(classifyStripePaymentLifecycle(payload({ type: "payment_intent.payment_failed" }), "acct_123")).toMatchObject({ ok: true, value: { action: "PAYMENT_FAILED_REVIEW", terminal: true, canMutateBusinessTruth: false } });
    expect(classifyStripePaymentLifecycle(payload({ type: "checkout.session.expired" }), "acct_123")).toMatchObject({ ok: true, value: { action: "CHECKOUT_EXPIRED_REVIEW", terminal: true, canMutateBusinessTruth: false } });
  });

  test("allows only supported payment purposes including platform subscription", () => {
    expect(classifyStripePaymentLifecycle(payload({ data: { object: { ...payload().data.object, metadata: { workspaceId: "ws-clearnest", purpose: "PLATFORM_SUBSCRIPTION" } } } }), "acct_123")).toMatchObject({ ok: true, value: { purpose: "PLATFORM_SUBSCRIPTION" } });
    expect(classifyStripePaymentLifecycle(payload({ data: { object: { ...payload().data.object, metadata: { workspaceId: "ws-clearnest", purpose: "TIP" } } } }), "acct_123")).toMatchObject({ ok: false, code: "PAYMENT_PURPOSE_INVALID" });
  });

  test("rejects account mismatch and invalid amount before lifecycle action", () => {
    expect(classifyStripePaymentLifecycle(payload({ account: "acct_other" }), "acct_123")).toMatchObject({ ok: false, code: "PAYMENT_ACCOUNT_MISMATCH" });
    expect(classifyStripePaymentLifecycle(payload({ data: { object: { ...payload().data.object, amount_total: 0 } } }), "acct_123")).toMatchObject({ ok: false, code: "PAYMENT_AMOUNT_INVALID" });
  });
});
