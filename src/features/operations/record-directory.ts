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
  const needle = normalizeDirectoryQuery(query).toLocaleLowerCase("en");
  if (!needle) return [...rows];
  return rows.filter((row) => searchTerms(row).some((value) =>
    String(value ?? "").toLocaleLowerCase("en").includes(needle),
  ));
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
