/**
 * Tenant-authorized snapshot search. Do not call providers, persist search terms,
 * or expand the dataset beyond the records supplied by the staff data boundary.
 */
export function normalizeDirectoryQuery(query?: string): string {
  return (query ?? "").trim().replace(/\s+/g, " ").slice(0, 100);
}

export function filterDirectoryRows<T>(
  rows: readonly T[],
  query: string | undefined,
  searchTerms: (row: T) => readonly (string | number | null | undefined)[],
): T[] {
  const normalized = normalizeDirectoryQuery(query).toLocaleLowerCase("en");
  if (!normalized) return [...rows];
  const tokens = normalized.split(" ").filter(Boolean);
  return rows.filter((row) => {
    const fields = searchTerms(row).map((value) => String(value ?? "").toLocaleLowerCase("en"));
    return tokens.every((token) => fields.some((field) => field.includes(token)));
  });
}

export function directoryRecordHref(
  key: "customer" | "request" | "quote" | "invoice",
  id: string,
  query?: string,
): string {
  const params = new URLSearchParams([[key, id]]);
  const search = normalizeDirectoryQuery(query);
  if (search) params.set("search", search);
  return "?" + params.toString();
}
