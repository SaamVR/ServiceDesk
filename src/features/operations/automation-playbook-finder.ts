import type { AutomationPlaybook } from "./automation-playbooks";

export type PlaybookCategoryFilter = "All" | AutomationPlaybook["category"];
export type PlaybookSeverityFilter = "Any" | AutomationPlaybook["severity"];

/** Search only the static 27 internal-attention starter descriptions.
 * This is NOT an AI rule generator or a provider action. */
export function filterAutomationPlaybooks(
  source: readonly AutomationPlaybook[],
  input: { search: string; category: PlaybookCategoryFilter; severity: PlaybookSeverityFilter },
): AutomationPlaybook[] {
  // An owner can search across the actual attributes of one starter:
  // "deep warning" should find relevant draft recipes even when those
  // words appear in different fields. All tokens must match the SAME rule.
  // The source remains the immutable internal-only catalogue; no AI call,
  // rule publish or external action is involved.
  if (!input || typeof input.search !== "string") return [];
  // Treat human-readable "move-out", machine-readable "MOVE_OUT" and
  // typographic dashes as equivalent word boundaries. This still searches
  // only one local, inert starter at a time and never generates a live rule.
  const normalize = (value: string) => value.normalize("NFKC").toLowerCase()
    .replace(/[\u2010-\u2015_-]+/g, " ").replace(/\s+/g, " ").trim();
  const terms = normalize(input.search.slice(0, 80)).split(/\\s+/).filter(Boolean).slice(0, 8);
  return source.filter(item => {
    if ((input.category !== "All" && input.category !== item.category) ||
        (input.severity !== "Any" && input.severity !== item.severity))
      return false;
    const searchable = [
      item.name, item.description, item.category, item.eventType,
      item.actionDetail, item.code, item.severity,
    ].map(value => normalize(value));
    return terms.every(term => searchable.some(value => value.includes(term)));
  });
}
