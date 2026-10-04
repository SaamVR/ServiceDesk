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
});
