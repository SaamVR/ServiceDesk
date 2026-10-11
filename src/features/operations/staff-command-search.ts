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
  const normalized = term.trim().toLocaleLowerCase("en");
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
  return results.sort((a, b) => a.score - b.score || a.index - b.index)
    .slice(0, Math.max(0, Math.min(13, Math.floor(Number.isFinite(limit) ? limit : 13))))
    .map(item => ({ module: item.module, label: item.label, eyebrow: item.eyebrow,
      description: item.description, href: item.href }));
}
