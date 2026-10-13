/** Read-only commercial preflight. Not a payment authorization or provider receipt.
 * Caller separately proves customer/workspace ownership and applies durable
 * DB/payment state transitions after the sandbox checkout is completed. */
export type CustomerInvoiceCheckoutFacts = {
  status: string;
  currency: string;
  totalMinor: number;
  allocatedMinor: number;
  refundedMinor: number;
  balanceMinor: number;
  quoteStatus: string;
  quoteCurrency: string;
};

export function customerInvoiceSandboxReadiness(f: CustomerInvoiceCheckoutFacts):
  | { ok: true; amountMinor: number; currency: string }
  | { ok: false; reason: "NOT_ISSUED" | "NO_BALANCE" | "AMOUNTS_MISMATCH" | "CURRENCY_MISMATCH" | "QUOTE_NOT_ACCEPTED" } {
  if (f.status === "PAID") return { ok: false, reason: "NO_BALANCE" };
  if (f.status !== "ISSUED" && f.status !== "PARTIALLY_PAID") {
    return { ok: false, reason: "NOT_ISSUED" };
  }
  if (f.balanceMinor === 0) return { ok: false, reason: "NO_BALANCE" };
  const values = [f.totalMinor, f.allocatedMinor, f.refundedMinor, f.balanceMinor];
  if (values.some(n => !Number.isSafeInteger(n) || n < 0) ||
      f.totalMinor <= 0 || f.balanceMinor <= 0 ||
      f.allocatedMinor < f.refundedMinor ||
      f.allocatedMinor - f.refundedMinor + f.balanceMinor !== f.totalMinor) {
    return { ok: false, reason: "AMOUNTS_MISMATCH" };
  }
  if (!/^[A-Z]{3}$/.test(f.currency) || f.currency !== f.quoteCurrency) {
    return { ok: false, reason: "CURRENCY_MISMATCH" };
  }
  if (f.quoteStatus !== "ACCEPTED") return { ok: false, reason: "QUOTE_NOT_ACCEPTED" };
  return { ok: true, amountMinor: f.balanceMinor, currency: f.currency };
}
