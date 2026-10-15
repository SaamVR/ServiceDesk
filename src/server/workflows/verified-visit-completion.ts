/** A status flag does not prove that a visit has actually started.
 * Staff may complete a visit early, so the scheduled END is not required
 * to be in the past; START must be at or before the current time.
 */
export function isVerifiedCompletedVisit(
  row: Record<string, unknown>,
  nowMs = Date.now(),
): boolean {
  if (row.status !== "COMPLETED" ||
      typeof row.starts_at !== "string" ||
      typeof row.ends_at !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(row.starts_at) ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(row.ends_at)) return false;
  const start=Date.parse(row.starts_at), end=Date.parse(row.ends_at);
  return Number.isFinite(nowMs) && Number.isFinite(start) &&
    Number.isFinite(end) && start <= nowMs && end > start;
}
