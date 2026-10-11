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
