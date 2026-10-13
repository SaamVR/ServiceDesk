/** Exact read-only presentation of persisted invoice allocations.
 * A row's status or gross allocations are not independently verified
 * payment-provider receipts. Never present an unsafe sum as customer money.
 */
export interface CustomerInvoiceLedgerFacts {
  totalMinor: unknown;
  allocatedMinor: unknown;
  refundedMinor: unknown;
  balanceMinor: unknown;
  currency: unknown;
}
export type CustomerInvoiceLedgerSummary =
  | { ok: true; grossAllocatedMinor: number; refundsMinor: number;
      netAppliedMinor: number; balanceMinor: number; totalMinor: number }
  | { ok: false; reason: "INVOICE_LEDGER_UNVERIFIED" };

export function readCustomerInvoiceLedgerSummary(
  f: CustomerInvoiceLedgerFacts,
): CustomerInvoiceLedgerSummary {
  const amounts = [f.totalMinor, f.allocatedMinor, f.refundedMinor, f.balanceMinor];
  if (typeof f.currency !== "string" || !/^[A-Z]{3}$/.test(f.currency) ||
      amounts.some(v => typeof v !== "number" || !Number.isSafeInteger(v) || v < 0) ||
      (f.totalMinor as number) <= 0 ||
      (f.allocatedMinor as number) < (f.refundedMinor as number)) {
    return { ok: false, reason: "INVOICE_LEDGER_UNVERIFIED" };
  }
  const net = (f.allocatedMinor as number) - (f.refundedMinor as number);
  const reconciled = net + (f.balanceMinor as number);
  if (!Number.isSafeInteger(net) || !Number.isSafeInteger(reconciled) ||
      reconciled !== f.totalMinor) {
    return { ok: false, reason: "INVOICE_LEDGER_UNVERIFIED" };
  }
  return {
    ok: true, totalMinor: f.totalMinor as number,
    grossAllocatedMinor: f.allocatedMinor as number,
    refundsMinor: f.refundedMinor as number,
    netAppliedMinor: net,
    balanceMinor: f.balanceMinor as number,
  };
}
