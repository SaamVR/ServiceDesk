import { describe, expect, it } from "vitest";
import { buildInvoiceLedgerView } from "../../src/features/invoices/view-models";
import { sampleInvoice } from "../../src/features/operations/sample-data";

describe("invoice allocation ledger model", () => {
  it("derives paid, refunded and balance states from InvoiceDTO only", () => {
    const view = buildInvoiceLedgerView(sampleInvoice);

    expect(view.statusLabel).toBe("PARTIALLY_PAID");
    expect(view.totalLabel).toBe("$340.00");
    expect(view.allocatedLabel).toBe("$85.00");
    expect(view.balanceLabel).toBe("$255.00");
    expect(view.progressLabel).toBe("25% collected");
    expect(view.receiptBoundary).toContain("verified payment callback");
  });

  it("does not claim a receipt when the invoice is not fully paid", () => {
    const view = buildInvoiceLedgerView(sampleInvoice);

    expect(view.canShowFinalReceipt).toBe(false);
    expect(view.nextAction).toBe("Collect remaining balance after reviewed completion");
  });

  it("does not show a final receipt for inconsistent paid invoice with insufficient net payment", () => {
    const view = buildInvoiceLedgerView({
      ...sampleInvoice,
      status: "PAID",
      allocatedMinor: sampleInvoice.totalMinor - 100,
      refundedMinor: 0,
      balanceMinor: 0,
    });

    expect(view.progressLabel).toBe("100% collected");
    expect(view.canShowFinalReceipt).toBe(false);
    expect(view.nextAction).toBe("Collect remaining balance after reviewed completion");
  });

  it("clamps over-allocation and refund combinations to 100 percent collected", () => {
    const view = buildInvoiceLedgerView({
      ...sampleInvoice,
      status: "PAID",
      allocatedMinor: sampleInvoice.totalMinor * 2,
      refundedMinor: sampleInvoice.totalMinor / 2,
      balanceMinor: 0,
    });

    expect(view.progressLabel).toBe("100% collected");
  });

  it("keeps coherent fully paid invoices eligible for final receipt", () => {
    const view = buildInvoiceLedgerView({
      ...sampleInvoice,
      status: "PAID",
      allocatedMinor: sampleInvoice.totalMinor,
      refundedMinor: 0,
      balanceMinor: 0,
    });

    expect(view.progressLabel).toBe("100% collected");
    expect(view.canShowFinalReceipt).toBe(true);
    expect(view.nextAction).toBe("Final receipt can be shown");
  });
});
