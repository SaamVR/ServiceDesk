import { describe, expect, it } from "vitest";
import type { InvoiceDTO, QuoteDTO, SlotDTO, VisitDTO } from "../../src/contracts";
import { buildCheckoutView } from "../../src/features/checkout/view-models";
import { sampleInvoice, sampleQuote, sampleSlot, sampleVisit } from "../../src/features/operations/sample-data";

describe("checkout view model", () => {
  it("separates quote, slot hold, sandbox payment and confirmed visit states", () => {
    const view = buildCheckoutView({
      quote: { ...sampleQuote, status: "ACCEPTED" },
      slot: { ...sampleSlot, availabilityFresh: true },
      visit: { ...sampleVisit, status: "AWAITING_PAYMENT" },
      invoice: { ...sampleInvoice, status: "PARTIALLY_PAID", allocatedMinor: sampleQuote.depositMinor },
      paymentMode: "SANDBOX",
      holdExpiresAt: "2026-10-04T06:30:00.000Z",
    });

    expect(view.quoteState).toBe("Quote accepted · version 2");
    expect(view.slotState).toBe("Fresh slot on hold");
    expect(view.paymentState).toBe("Sandbox checkout · deposit recorded");
    expect(view.visitState).toBe("Awaiting payment before confirmation");
    expect(view.canShowReceipt).toBe(false);
    expect(view.warning).toContain("sandbox");
  });

  it("blocks instant booking when the slot is stale", () => {
    const view = buildCheckoutView({
      quote: sampleQuote,
      slot: { ...sampleSlot, availabilityFresh: false },
      visit: sampleVisit,
      invoice: sampleInvoice,
      paymentMode: "FIXTURE",
      holdExpiresAt: "2026-10-04T06:30:00.000Z",
    });

    expect(view.slotState).toBe("Calendar stale · staff review required");
    expect(view.primaryAction).toBe("Ask staff to refresh availability");
  });

  it("routes late expired-hold payment callbacks to payment review", () => {
    const lateVisit: VisitDTO = { ...sampleVisit, status: "PAYMENT_REVIEW" };
    const expiredQuote: QuoteDTO = { ...sampleQuote, status: "EXPIRED" };
    const paidInvoice: InvoiceDTO = { ...sampleInvoice, status: "PARTIALLY_PAID", allocatedMinor: sampleQuote.depositMinor };
    const slot: SlotDTO = { ...sampleSlot, availabilityFresh: false };

    const view = buildCheckoutView({
      quote: expiredQuote,
      slot,
      visit: lateVisit,
      invoice: paidInvoice,
      paymentMode: "SANDBOX",
      holdExpiresAt: "2026-10-04T06:30:00.000Z",
    });

    expect(view.visitState).toBe("Payment review required");
    expect(view.primaryAction).toBe("Open payment review");
    expect(view.canShowReceipt).toBe(false);
  });
});
