import type { AutomationPlaybook } from "./automation-playbooks";

export type PlaybookCategoryFilter = "All" | AutomationPlaybook["category"];
export type PlaybookSeverityFilter = "Any" | AutomationPlaybook["severity"];

/** Search only the static 27 internal-attention starter descriptions.
 * This is NOT an AI rule generator or a provider action. */
export function filterAutomationPlaybooks(
  source: readonly AutomationPlaybook[],
  input: { search: string; category: PlaybookCategoryFilter; severity: PlaybookSeverityFilter },
): AutomationPlaybook[] {
  const term = input.search.slice(0, 80).trim().replace(/\s+/g, " ").toLowerCase();
  return source.filter(item =>
    (input.category === "All" || input.category === item.category) &&
    (input.severity === "Any" || input.severity === item.severity) &&
    (!term || [
      item.name, item.description, item.category, item.eventType,
      item.actionDetail, item.code,
    ].some(value => value.toLowerCase().includes(term))));
}
