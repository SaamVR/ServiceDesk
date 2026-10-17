/**
 * Bounded, in-memory indexes over the already authorized staff snapshot.
 * Keep FIRST matching ID to preserve earlier Array.find() semantics.
 * These indexes do not query, cache persistently, log or expand access.
 */
export function indexStaffById<T extends { id: string }>(records: readonly T[]): Map<string, T> {
  const indexed = new Map<string, T>();
  for (const record of records) {
    if (!indexed.has(record.id)) indexed.set(record.id, record);
  }
  return indexed;
}

export function countStaffBy<T>(
  records: readonly T[],
  select: (record: T) => string | null | undefined,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const record of records) {
    const key = select(record);
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/** Stable, linear-time current quote lookup. Authorization comes from the
 * source staff snapshot; this cannot fetch or expose other tenant records.
 * An older unsuperseded quote must not shadow a newer version because the
 * database happened to return the rows in a different order.
 */
/** Two non-superseded records with the same highest version cannot both
 * establish the authoritative current offer. Count conflicts by REQUEST,
 * never by quote rows. Older-version duplicates do not poison a newer
 * unambiguous saved offer.
 */
export function indexAmbiguousCurrentQuoteRequests<T extends { requestId: string; version: number; status: string }>(
  quotes: readonly T[],
): ReadonlySet<string> {
  const latest = new Map<string, { version: number; count: number }>();
  for (const quote of quotes) {
    if (quote.status === "SUPERSEDED") continue;
    const prev = latest.get(quote.requestId);
    if (!prev || quote.version > prev.version) {
      latest.set(quote.requestId, { version: quote.version, count: 1 });
    } else if (quote.version === prev.version) {
      prev.count++;
    }
  }
  return new Set([...latest].filter(([, value]) => value.count > 1).map(([id]) => id));
}

export function indexCurrentQuoteByRequest<T extends { requestId: string; version: number; status: string }>(
  quotes: readonly T[],
): Map<string, T> {
  const current = new Map<string, T>();
  const ambiguous = indexAmbiguousCurrentQuoteRequests(quotes);
  for (const quote of quotes) {
    if (ambiguous.has(quote.requestId)) continue;
    if (quote.status === "SUPERSEDED") continue;
    const previous = current.get(quote.requestId);
    if (!previous || quote.version > previous.version) current.set(quote.requestId, quote);
  }
  return current;
}
