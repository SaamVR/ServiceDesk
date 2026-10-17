/**
 * Verify persisted staff-facing quote facts before projection.
 * In operational-product-runtime the historical numberValue() helper treats
 * absent/invalid monetary columns as zero; String(undefined) can likewise
 * fabricate an identity. Neither is acceptable for an APPROVED quote or a
 * quote that may become a staff send candidate.
 *
 * Snapshot loading fails closed for a malformed row; no quote write/send occurs.
 */
const quoteStatuses = new Set([
  "DRAFT","PENDING_APPROVAL","APPROVED","SENT","ACCEPTED","DECLINED","EXPIRED","SUPERSEDED",
]);
const minorAndDurationColumns = [
  "subtotal_minor","tax_minor","total_minor","deposit_minor","balance_minor",
  "duration_minutes","buffer_minutes",
] as const;

export function isSavedStaffQuoteRowVerifiable(row: Record<string,unknown>): boolean {
  if (typeof row.id !== "string" || !row.id.trim() ||
      typeof row.request_id !== "string" || !row.request_id.trim() ||
      typeof row.status !== "string" || !quoteStatuses.has(row.status) ||
      typeof row.currency !== "string" || !/^[A-Z]{3}$/.test(row.currency) ||
      typeof row.version !== "number" || !Number.isSafeInteger(row.version) ||
      row.version < 1) return false;
  if (!minorAndDurationColumns.every(column =>
    typeof row[column] === "number" && Number.isSafeInteger(row[column]) &&
    (row[column] as number) >= 0)) return false;
  // A correctly typed but contradictory quote is not a verified monetary
  // snapshot. Enforce the same saved financial equations already required by
  // the server's quote-send guard, including for Today/owner aggregates.
  const subtotal = row.subtotal_minor as number;
  const tax = row.tax_minor as number;
  const total = row.total_minor as number;
  const deposit = row.deposit_minor as number;
  const balance = row.balance_minor as number;
  return Number.isSafeInteger(subtotal + tax) &&
    Number.isSafeInteger(deposit + balance) &&
    subtotal + tax === total && deposit + balance === total;
}
