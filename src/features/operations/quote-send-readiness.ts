import { readVerifiedCustomerQuoteLineItems } from "./customer-quote-line-items";

/** Staff quote-send precondition. The DB RPC retains final version/status authority. */
export function assessOperationalQuoteSend(
  quote: Record<string, unknown>, at: string,
): { ok: true } | { ok: false; reason: "NOT_APPROVED" | "EXPIRED" | "CHARGES_UNVERIFIED" } {
  if (quote.status !== "APPROVED") return { ok: false, reason: "NOT_APPROVED" };
  const now = Date.parse(at);
  const until = typeof quote.valid_until === "string" ? Date.parse(quote.valid_until) : NaN;
  if (!Number.isFinite(now) || !Number.isFinite(until) || until <= now) {
    return { ok: false, reason: "EXPIRED" };
  }
  const values = [quote.subtotal_minor, quote.tax_minor, quote.total_minor,
    quote.deposit_minor, quote.balance_minor, quote.duration_minutes];
  if (values.some(value => typeof value !== "number" ||
      !Number.isSafeInteger(value) || value < 0) ||
      (quote.subtotal_minor as number) + (quote.tax_minor as number) !== quote.total_minor ||
      (quote.deposit_minor as number) + (quote.balance_minor as number) !== quote.total_minor) {
    return { ok: false, reason: "CHARGES_UNVERIFIED" };
  }
  const items = readVerifiedCustomerQuoteLineItems(
    quote.snapshot,
    quote.subtotal_minor as number,
    quote.duration_minutes as number,
    quote.tax_minor as number,
    quote.total_minor as number,
  );
  if (!items) return { ok: false, reason: "CHARGES_UNVERIFIED" };
  return { ok: true };
}
