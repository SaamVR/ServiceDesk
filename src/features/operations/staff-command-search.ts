import { buildStaffModuleHref, staffModuleConfig, type StaffModule } from "./staff-modules";

/**
 * Search only existing staff destinations. This is a navigation aid, not
 * customer/global data search or authorization. Every route independently
 * authenticates the actor and enforces workspace membership.
 */
export interface StaffCommandDestination {
  module: StaffModule;
  label: string;
  eyebrow: string;
  description: string;
  href: string;
}

/** Navigation terms are not customer data. Strip invisible direction/control
 * marks to prevent visually misleading destinations and bounded deep links.
 * Do not erase real Bangla, Banglish or other visible Unicode search text.
 */
export function normalizeStaffCommandQuery(raw: string): string {
  return raw.normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/gu," ")
    .replace(/\s+/gu," ").trim().slice(0,100);
}

const orderedModules: readonly StaffModule[] = [
  "overview", "inbox", "schedule", "jobs",
  "requests", "quotes", "customers", "invoices",
  "quality", "automations", "reports", "billing", "settings",
];

export function searchStaffDestinations(
  workspace: string,
  term: string,
  limit = 13,
): StaffCommandDestination[] {
  const normalized = normalizeStaffCommandQuery(term).toLocaleLowerCase("en");
  const tokens = normalized.split(/\s+/).filter(Boolean);
  const results = orderedModules.flatMap((module, index) => {
    const entry = staffModuleConfig[module];
    const label = entry.label.toLocaleLowerCase("en");
    const fields = [label, entry.eyebrow.toLocaleLowerCase("en"), entry.description.toLocaleLowerCase("en")];
    if (!tokens.every(token => fields.some(field => field.includes(token)))) return [];
    const starts = normalized ? (label.startsWith(normalized) ? 0 : label.includes(normalized) ? 1 : 2) : 0;
    return [{ module, label: entry.label, eyebrow: entry.eyebrow, description: entry.description,
      href: buildStaffModuleHref(workspace, module), score: starts, index }];
  });
  // The Studio is an actual scoped route nested under Automations.
  // Show it only for a relevant nonempty query, preserving the 13 existing
  // module destinations and their workday-first empty-search order.
  if (normalized) {
    const label = "AI Studio";
    const eyebrow = "Saved workflow and model review";
    const description = "Review AI request briefs, owner model diagnostics and saved execution evidence.";
    const fields = [label, eyebrow, description].map(value => value.toLocaleLowerCase("en"));
    if (tokens.every(token => fields.some(field => field.includes(token)))) {
      results.push({
        module: "automations", label, eyebrow, description,
        href: buildStaffModuleHref(workspace, "automations") + "/ai-studio",
        score: label.toLowerCase().startsWith(normalized) ? 0 : 1,
        index: -1,
      });
    }
  }
  return results.sort((a, b) => a.score - b.score || a.index - b.index)
    .slice(0, Math.max(0, Math.min(13, Math.floor(Number.isFinite(limit) ? limit : 13))))
    .map(item => ({ module: item.module, label: item.label, eyebrow: item.eyebrow,
      description: item.description, href: item.href }));
}

/** Existing server-owned directory searches, not client-loaded customer data.
 * The route itself enforces tenant authorization before fetching results.
 */
export interface StaffRecordSearchTarget {
  module: "inbox" | "customers" | "requests" | "quotes" | "invoices" | "jobs" | "quality";
  label: string;
  href: string;
}
/** Keep these query keys aligned with the actual authorized GET route parsers.
 * Jobs uses 'search', while Quality uses 'q'. Both run only after server-side
 * workspace authorization; no records are fetched into the command palette.
 */
const recordSearchModules: readonly {
  module: StaffRecordSearchTarget["module"];
  label: string;
  queryKey: "search" | "q";
}[] = [
  { module: "inbox", label: "Conversations", queryKey: "search" },
  { module: "customers", label: "Customers", queryKey: "search" },
  { module: "requests", label: "Requests", queryKey: "search" },
  { module: "quotes", label: "Quotes", queryKey: "search" },
  { module: "jobs", label: "Jobs", queryKey: "search" },
  { module: "quality", label: "Quality cases", queryKey: "q" },
  { module: "invoices", label: "Invoices", queryKey: "search" },
];
export function buildStaffRecordSearches(workspace:string, rawQuery:string):StaffRecordSearchTarget[] {
  const term = normalizeStaffCommandQuery(rawQuery);
  if (term.length < 2) return [];
  return recordSearchModules.map(({ module, label, queryKey }) => ({
    module,
    label,
    href: buildStaffModuleHref(workspace, module) + "?" + queryKey + "=" + encodeURIComponent(term),
  }));
}
