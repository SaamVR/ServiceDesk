import { describe, expect, it } from "vitest";
import { buildCheckoutView } from "../../src/features/checkout/view-models";
import { sampleInvoice, sampleQuote, sampleSlot, sampleVisit } from "../../src/features/operations/sample-data";

const now = "2026-10-04T06:00:00.000Z";
const expiresAt = "2026-10-04T06:30:00.000Z";
const acceptedQuote = { ...sampleQuote, status: "ACCEPTED" as const };
const freshSlot = { ...sampleSlot, availabilityFresh: true };
const heldSlot = { slot: freshSlot, holdId: "hold_1", expiresAt, quoteId: acceptedQuote.id, expectedQuoteVersion: acceptedQuote.version };

describe("checkout view model", () => {
  it("enables only the safe sandbox launch after accepted quote and authoritative hold", () => {
    const view = buildCheckoutView({
      quote: acceptedQuote,
      slot: freshSlot,
      visit: { ...sampleVisit, status: "AWAITING_PAYMENT" },
      invoice: sampleInvoice,
      paymentMode: "SANDBOX",
      holdExpiresAt: expiresAt,
      heldSlot,
      sandboxCheckoutHandlerInjected: true,
      now,
    });
    expect(view.quoteState).toBe("Quote accepted · version 2");
    expect(view.slotState).toBe("Fresh slot on hold");
    expect(view.primaryAction).toBe("Launch sandbox checkout");
    expect(view.checkoutAvailability.enabled).toBe(true);
    expect(view.paymentState).toContain("payment pending");
    expect(view.canShowReceipt).toBe(false);
  });

  it("keeps checkout unavailable without an authoritative hold", () => {
    const view = buildCheckoutView({
      quote: acceptedQuote,
      slot: { ...sampleSlot, availabilityFresh: false },
      visit: sampleVisit,
      invoice: sampleInvoice,
      paymentMode: "FIXTURE",
      holdExpiresAt: expiresAt,
      sandboxCheckoutHandlerInjected: true,
      now,
    });
    expect(view.slotState).toBe("Calendar stale · staff review required");
    expect(view.primaryAction).toBe("Hold a slot first");
    expect(view.checkoutAvailability.enabled).toBe(false);
  });

  it("blocks an expired authoritative hold", () => {
    const view = buildCheckoutView({
      quote: acceptedQuote,
      slot: freshSlot,
      visit: sampleVisit,
      invoice: sampleInvoice,
      paymentMode: "SANDBOX",
      holdExpiresAt: "2026-10-04T05:59:00.000Z",
      heldSlot: { ...heldSlot, expiresAt: "2026-10-04T05:59:00.000Z" },
      sandboxCheckoutHandlerInjected: true,
      now,
    });
    expect(view.primaryAction).toBe("Hold expired");
    expect(view.checkoutAvailability.enabled).toBe(false);
  });

  it("keeps payment review visible and never synthesizes a receipt", () => {
    const view = buildCheckoutView({
      quote: acceptedQuote,
      slot: freshSlot,
      visit: { ...sampleVisit, status: "PAYMENT_REVIEW" },
      invoice: { ...sampleInvoice, status: "PARTIALLY_PAID", allocatedMinor: sampleQuote.depositMinor },
      paymentMode: "SANDBOX",
      holdExpiresAt: expiresAt,
      heldSlot,
      sandboxCheckoutHandlerInjected: true,
      now,
    });
    expect(view.visitState).toBe("Payment review required");
    expect(view.canShowReceipt).toBe(false);
    expect(view.warning).toContain("SANDBOX/demo");
  });

  it("does not allow a caller-selected LIVE mode to create live or paid truth", () => {
    const view = buildCheckoutView({
      quote: acceptedQuote,
      slot: freshSlot,
      visit: { ...sampleVisit, status: "CONFIRMED" },
      invoice: { ...sampleInvoice, allocatedMinor: sampleQuote.depositMinor },
      paymentMode: "LIVE",
      holdExpiresAt: expiresAt,
      heldSlot,
      sandboxCheckoutHandlerInjected: true,
      now,
    });
    expect(view.canShowReceipt).toBe(false);
    expect(view.warning).toContain("Current payment policy is SANDBOX/demo");
    expect(view.primaryAction).toBe("Launch sandbox checkout");
  });

  it("labels launched sandbox checkout as payment pending rather than paid", () => {
    const view = buildCheckoutView({
      quote: acceptedQuote,
      slot: freshSlot,
      visit: { ...sampleVisit, status: "AWAITING_PAYMENT" },
      invoice: sampleInvoice,
      paymentMode: "SANDBOX",
      holdExpiresAt: expiresAt,
      heldSlot,
      sandboxCheckoutHandlerInjected: true,
      now,
      sandboxCheckout: {
        checkoutUrl: "https://checkout.stripe.test/session",
        providerSessionId: "cs_test_123",
        amountMinor: acceptedQuote.depositMinor,
        currency: acceptedQuote.currency,
        mode: "SANDBOX",
        state: "PAYMENT_PENDING",
      },
    });
    expect(view.paymentState).toBe("SANDBOX CHECKOUT LAUNCHED / PAYMENT PENDING");
    expect(view.primaryAction).toBe("Continue sandbox checkout");
    expect(view.checkoutUrl).toBe("https://checkout.stripe.test/session");
    expect(view.canShowReceipt).toBe(false);
  });
});
