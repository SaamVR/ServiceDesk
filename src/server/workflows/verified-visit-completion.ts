import { trustedQuoteInstant } from "../../features/operations/quote-validity-clock";

/** A status flag does not prove that a visit has actually started.
 * Staff may complete a visit early, so the scheduled END is not required
 * to be in the past; START must be at or before the current time.
 *
 * Only exact civil-valid zoned persisted timestamps authorize a workflow
 * source. JS Date.parse alone normalizes Feb 30 and accepts local datetimes.
 */
export function isVerifiedCompletedVisit(
  row: Record<string, unknown>,
  nowMs = Date.now(),
): boolean {
  if (!row || typeof row !== "object" || Array.isArray(row) ||
      ![Object.prototype,null].includes(Object.getPrototypeOf(row)) ||
      Object.getOwnPropertySymbols(row).length !== 0 ||
      Object.getOwnPropertyNames(row).length !== Object.keys(row).length ||
      Object.values(Object.getOwnPropertyDescriptors(row)).some(
        desc => !Object.hasOwn(desc,"value")) ||
      !["status","starts_at","ends_at"].every(k=>Object.hasOwn(row,k)) ||
      row.status !== "COMPLETED" || !Number.isFinite(nowMs)) return false;
  const start=trustedQuoteInstant(row.starts_at);
  const end=trustedQuoteInstant(row.ends_at);
  return start !== null && end !== null && start <= nowMs && end > start;
}
