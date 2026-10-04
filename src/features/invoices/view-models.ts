import type { InvoiceDTO } from "@/contracts";

function money(minor: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(minor / 100);
}

export function buildInvoiceLedgerView(invoice: InvoiceDTO) {
  const paidMinor = Math.max(invoice.allocatedMinor - invoice.refundedMinor, 0);
  const collectedRatio = invoice.totalMinor > 0 ? paidMinor / invoice.totalMinor : 0;
  const collectedPercent = Math.min(100, Math.max(0, Math.round(collectedRatio * 100)));
  const hasFullNetPayment = invoice.totalMinor > 0 && paidMinor >= invoice.totalMinor;
  const canShowFinalReceipt = invoice.status === "PAID" && invoice.balanceMinor === 0 && hasFullNetPayment;

  return {
    invoiceId: invoice.id,
    statusLabel: invoice.status,
    totalLabel: money(invoice.totalMinor, invoice.currency),
    allocatedLabel: money(invoice.allocatedMinor, invoice.currency),
    refundedLabel: money(invoice.refundedMinor, invoice.currency),
    balanceLabel: money(invoice.balanceMinor, invoice.currency),
    progressLabel: `${collectedPercent}% collected`,
    canShowFinalReceipt,
    nextAction: canShowFinalReceipt ? "Final receipt can be shown" : "Collect remaining balance after reviewed completion",
    receiptBoundary: "Final receipt is hidden until a verified payment callback allocates the full balance.",
    ledgerRows: [
      { label: "Total", value: money(invoice.totalMinor, invoice.currency) },
      { label: "Allocated", value: money(invoice.allocatedMinor, invoice.currency) },
      { label: "Refunded", value: money(invoice.refundedMinor, invoice.currency) },
      { label: "Balance", value: money(invoice.balanceMinor, invoice.currency) },
    ],
  };
}
