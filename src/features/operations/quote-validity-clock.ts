/** Saved quote expiry must include an explicit timezone. Unzoned ISO times
 * are interpreted differently by browsers and servers, and cannot authorize
 * staff delivery or authenticated customer acceptance.
 */
export function trustedQuoteInstant(value: unknown): number | null {
  if (typeof value !== "string") return null;
  // PostgreSQL timestamps can include microseconds. JavaScript Date.parse
  // may silently normalize invalid days; validate the written civil date
  // before trusting the resulting instant for a monetary/approval decision.
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > days[month - 1] ||
      hour > 23 || minute > 59 || second > 59) return null;
  // Explicit UTC offsets must be real civil time-zone offsets; do not rely
  // on permissive Date.parse normalization or client-local interpretation.
  const zone = match[7];
  if (zone !== "Z") {
    const hours = Number(zone.slice(1, 3));
    const minutes = Number(zone.slice(4, 6));
    if (hours > 14 || minutes > 59 || (hours === 14 && minutes !== 0)) return null;
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function hasCurrentSavedQuoteExpiry(at: unknown, expiry: unknown): boolean {
  const now = trustedQuoteInstant(at);
  const until = trustedQuoteInstant(expiry);
  return now !== null && until !== null && until > now;
}
