/** A PAID invoice is an authoritative milestone only if the saved ledger
 * reconciles. Do not trigger owner workflows from a mutated status flag.
 */
export function isVerifiedPaidInvoiceMilestone(row: Record<string, unknown>): boolean {
  const totals = [row.total_minor, row.allocated_minor, row.refunded_minor, row.balance_minor];
  return row.status === "PAID" &&
    totals.every(n => typeof n === "number" && Number.isSafeInteger(n) && n >= 0) &&
    (row.total_minor as number) > 0 &&
    row.balance_minor === 0 &&
    (row.allocated_minor as number) >= (row.refunded_minor as number) &&
    (row.allocated_minor as number) - (row.refunded_minor as number) === row.total_minor &&
    typeof row.currency === "string" && /^[A-Z]{3}$/.test(row.currency);
}
