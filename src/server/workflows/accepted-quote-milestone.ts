import { readVerifiedCustomerQuoteLineItems } from "@/features/operations/customer-quote-line-items";

/** A QUOTE_ACCEPTED automation must not execute merely because a row has
 * status ACCEPTED. Verify the actual persisted commercial snapshot first.
 * No rates, default price book or customer contact data are recomputed.
 */
export function isVerifiedAcceptedQuoteMilestone(row: Record<string, unknown>): boolean {
  const numbers = [row.subtotal_minor, row.tax_minor, row.total_minor,
    row.deposit_minor, row.balance_minor, row.duration_minutes];
  if (row.status !== "ACCEPTED" ||
      typeof row.currency !== "string" || !/^[A-Z]{3}$/.test(row.currency) ||
      numbers.some(n => typeof n !== "number" || !Number.isSafeInteger(n) || n < 0) ||
      (row.subtotal_minor as number) + (row.tax_minor as number) !== row.total_minor ||
      (row.deposit_minor as number) + (row.balance_minor as number) !== row.total_minor) {
    return false;
  }
  return readVerifiedCustomerQuoteLineItems(row.snapshot,
    row.subtotal_minor as number, row.duration_minutes as number,
    row.tax_minor as number, row.total_minor as number) !== null;
}
