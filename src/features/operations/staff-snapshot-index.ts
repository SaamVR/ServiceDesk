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
export function indexCurrentQuoteByRequest<T extends { requestId: string; version: number; status: string }>(
  quotes: readonly T[],
): Map<string, T> {
  const current = new Map<string, T>();
  for (const quote of quotes) {
    if (quote.status === "SUPERSEDED") continue;
    const previous = current.get(quote.requestId);
    if (!previous || quote.version > previous.version) current.set(quote.requestId, quote);
  }
  return current;
}
