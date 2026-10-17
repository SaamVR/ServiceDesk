/** Saved quote expiry must include an explicit timezone. Unzoned ISO times
 * are interpreted differently by browsers and servers, and cannot authorize
 * staff delivery or authenticated customer acceptance.
 */
export function trustedQuoteInstant(value: unknown): number | null {
  if (typeof value !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function hasCurrentSavedQuoteExpiry(at: unknown, expiry: unknown): boolean {
  const now = trustedQuoteInstant(at);
  const until = trustedQuoteInstant(expiry);
  return now !== null && until !== null && until > now;
}
