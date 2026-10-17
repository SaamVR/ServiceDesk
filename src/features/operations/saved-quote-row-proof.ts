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
  return minorAndDurationColumns.every(column =>
    typeof row[column] === "number" && Number.isSafeInteger(row[column]) &&
    (row[column] as number) >= 0);
}
