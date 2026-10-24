/**
 * Whitelist the only saved-record data serialized into AI Studio's browser.
 * The authenticated operational snapshot owns tenant/branch authorization.
 * No customer contacts, notes, addresses, prices or credentials are returned.
 */
export type StudioRecordChoice = { id: string; label: string };

const uuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const status = (value: unknown) =>
  typeof value === "string" && /^[A-Z][A-Z0-9_]{0,39}$/.test(value)
    ? value.replaceAll("_", " ") : "Status unavailable";

export function verifiedStudioRecordChoices(
  kind: "Request" | "Quote",
  rows: readonly { id: unknown; status: unknown }[],
): StudioRecordChoice[] {
  const seen = new Set<string>();
  const selections: StudioRecordChoice[] = [];
  for (const row of rows) {
    if (!row || !uuid(row.id) || seen.has(row.id)) continue;
    seen.add(row.id);
    selections.push({
      id: row.id,
      label: `${kind} ${selections.length + 1} · ID ${row.id.slice(0, 8)} · ${status(row.status)}`,
    });
    if (selections.length >= 40) break;
  }
  return selections;
}

/** Filter only the already-authorized, capped record labels and IDs.
 * Never fetch or broaden the browser's source scope from search text.
 */
export function filterStudioRecordChoices(
  records: readonly StudioRecordChoice[], query: string,
): StudioRecordChoice[] {
  // Every token must belong to an already authorized label or ID. This
  // supports searches like "Quote approved" without a network lookup.
  // Remove invisible formatting controls that could spoof a search filter.
  const queryTokens = query.slice(0,80)
    .replace(/[\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/gu,"")
    .toLocaleLowerCase("en").trim().split(/\s+/u).filter(Boolean);
  if (!queryTokens.length) return [...records];
  return records.filter(item => {
    const source = (item.label + " " + item.id).toLocaleLowerCase("en");
    return queryTokens.every(token => source.includes(token));
  });
}
