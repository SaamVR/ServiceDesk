import {
  readCustomerInvoiceLedgerSummary,
  type CustomerInvoiceLedgerFacts,
} from "./customer-invoice-ledger-summary";

export type BookingPaymentSummary = {
  title: string;
  detail: string;
  tone: "info" | "warning" | "success";
};

/** A booking is not paid merely because its invoice balance is zero.
 * Always reconcile the persisted invoice ledger and lifecycle together.
 * These facts are accounting records, not independent provider receipts.
 */
export function customerBookingPaymentSummary(
  invoice: CustomerInvoiceLedgerFacts & { status: string },
): BookingPaymentSummary {
  if (invoice.status === "VOID") {
    return { title: "Invoice void",
      detail: "This invoice has been voided. No payment is due on this invoice; ask the cleaning business about any replacement invoice.",
      tone: "info" };
  }
  if (invoice.status === "DRAFT") {
    return { title: "Invoice not issued",
      detail: "The invoice remains a draft. Any displayed amount is not yet a payable bill.",
      tone: "info" };
  }
  const ledger = readCustomerInvoiceLedgerSummary(invoice);
  if (!ledger.ok) return { title: "Payment figures need review",
    detail: "Saved payment allocations, refunds and the invoice balance do not reconcile. Contact the cleaning business before paying.",
    tone: "warning" };
  if (invoice.status === "PAID") {
    if (ledger.balanceMinor !== 0 || ledger.netAppliedMinor !== ledger.totalMinor) {
      return { title: "Paid status needs verification",
        detail: "The invoice is marked paid, but its saved ledger does not establish full settlement. Ask the business to review it.",
        tone: "warning" };
    }
    return { title: "Invoice recorded as paid",
      detail: "The saved invoice is settled after refunds. This is an accounting status, not an independent bank or provider receipt.",
      tone: "success" };
  }
  if ((invoice.status === "ISSUED" || invoice.status === "PARTIALLY_PAID") &&
      ledger.balanceMinor > 0) return {
        title: "Invoice balance outstanding",
        detail: "Your issued invoice has an outstanding balance. Open it to review the saved charges, refunds and available payment options.",
        tone: "warning" };
  return { title: "Invoice status needs review",
    detail: "The invoice is not recorded as fully paid or payable right now. Open it to review the current status with the business.",
    tone: "info" };
}
