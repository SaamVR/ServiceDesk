import { readVerifiedCustomerQuoteLineItems } from "./customer-quote-line-items";

/**
 * A customer must never accept a monetary quote if the saved breakdown is
 * missing, inconsistent, or expired. Staff must correct and re-send it.
 * Caller must separately establish the authenticated customer's ownership.
 */
export function verifyCustomerQuoteForAcceptance(
  row: Record<string, unknown>,
  now: string,
): { ok: true } | { ok: false; code: "QUOTE_NOT_SENT" | "QUOTE_EXPIRED" | "QUOTE_TOTAL_UNVERIFIED" | "QUOTE_BREAKDOWN_UNVERIFIED" } {
  if (row.status !== "SENT") return { ok: false, code: "QUOTE_NOT_SENT" };

  const nowMs = Date.parse(now);
  const expiryMs = typeof row.valid_until === "string" ? Date.parse(row.valid_until) : NaN;
  if (!Number.isFinite(nowMs) || !Number.isFinite(expiryMs) || expiryMs <= nowMs) {
    return { ok: false, code: "QUOTE_EXPIRED" };
  }
  const amounts = [row.subtotal_minor, row.tax_minor, row.total_minor,
    row.deposit_minor, row.balance_minor, row.duration_minutes];
  if (typeof row.currency !== "string" || !/^[A-Z]{3}$/.test(row.currency) ||
      amounts.some(n => typeof n !== "number" || !Number.isSafeInteger(n) || n < 0) ||
      (row.total_minor as number) <= 0 ||
      (row.subtotal_minor as number) + (row.tax_minor as number) !== row.total_minor ||
      (row.deposit_minor as number) + (row.balance_minor as number) !== row.total_minor) {
    return { ok: false, code: "QUOTE_TOTAL_UNVERIFIED" };
  }

  const items = readVerifiedCustomerQuoteLineItems(
    row.snapshot,
    row.subtotal_minor as number,
    row.duration_minutes as number,
    row.tax_minor as number,
    row.total_minor as number,
  );
  if (!items) return { ok: false, code: "QUOTE_BREAKDOWN_UNVERIFIED" };
  return { ok: true };
}
