/**
 * Customer-facing read-only interpretation of an already persisted quote.
 * Never recompute, guess or "fix" a line item from a separate rate card.
 * Reject inconsistent snapshots rather than presenting an invented bill.
 */
export interface CustomerQuoteLineItem {
  code: string;
  description: string;
  amountMinor: number;
  durationMinutes: number;
}

export function readVerifiedCustomerQuoteLineItems(
  snapshot: unknown,
  savedSubtotalMinor: number,
  savedDurationMinutes: number,
  savedTaxMinor: number,
  savedTotalMinor: number,
): CustomerQuoteLineItem[] | null {
  if (!Number.isSafeInteger(savedSubtotalMinor) || savedSubtotalMinor < 0 ||
      !Number.isSafeInteger(savedDurationMinutes) || savedDurationMinutes < 0 ||
      !Number.isSafeInteger(savedTaxMinor) || savedTaxMinor < 0 ||
      !Number.isSafeInteger(savedTotalMinor) || savedTotalMinor < 0 ||
      savedSubtotalMinor + savedTaxMinor !== savedTotalMinor ||
      !snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return null;

  const candidate = (snapshot as Record<string, unknown>).lineItems;
  if (!Array.isArray(candidate) || candidate.length < 1 || candidate.length > 25) return null;

  const normalized: CustomerQuoteLineItem[] = [];
  let amount = 0;
  let minutes = 0;
  for (const item of candidate) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const row = item as Record<string, unknown>;
    if (typeof row.code !== "string" || !/^[A-Z][A-Z0-9_]{1,31}$/.test(row.code) ||
        typeof row.description !== "string" || row.description.trim() !== row.description ||
        row.description.length < 1 || row.description.length > 140 ||
        /[\x00-\x1f\x7f]/.test(row.description) ||
        typeof row.amountMinor !== "number" || !Number.isSafeInteger(row.amountMinor) ||
        row.amountMinor < 0 || row.amountMinor > 1_000_000_000 ||
        typeof row.durationMinutes !== "number" || !Number.isSafeInteger(row.durationMinutes) ||
        row.durationMinutes < 0 || row.durationMinutes > 14 * 24 * 60) return null;
    amount += row.amountMinor;
    minutes += row.durationMinutes;
    if (!Number.isSafeInteger(amount) || !Number.isSafeInteger(minutes)) return null;
    normalized.push({
      code: row.code,
      description: row.description,
      amountMinor: row.amountMinor,
      durationMinutes: row.durationMinutes,
    });
  }
  return amount === savedSubtotalMinor && minutes === savedDurationMinutes
    ? normalized : null;
}
