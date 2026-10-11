/** Quality triage is read-only over the authenticated staff snapshot. */
export const qualityQueueOptions = [
  { key: "all", label: "All cases" },
  { key: "open", label: "Open" },
  { key: "review", label: "In review" },
  { key: "overdue", label: "Overdue" },
  { key: "unassigned", label: "Unassigned" },
  { key: "resolved", label: "Resolved" },
] as const;
export type QualityQueue = typeof qualityQueueOptions[number]["key"];
export type QualityCaseRecord = { id: string; state: string; summary: string; ownerUserId?: string | null; dueAt?: string | null; feedbackScore?: number };
export function normalizeQualityQueue(input?: string | null): QualityQueue {
  return qualityQueueOptions.find(option => option.key === input)?.key ?? "all";
}
export function normalizeQualitySearch(value?: string | null): string {
  return (value ?? "").trim().replace(/\s+/g, " ").slice(0, 100);
}
export function qualityQueueHref(queue: QualityQueue, search: string, caseId?: string): string {
  const p = new URLSearchParams();
  if (queue !== "all") p.set("queue", queue);
  if (search) p.set("q", normalizeQualitySearch(search));
  if (caseId) p.set("case", caseId);
  return "?" + p.toString();
}
export function qualityFeedbackPrefix(queue: QualityQueue, search: string, caseId: string): string {
  return qualityQueueHref(queue, search, caseId).slice(1) + "&";
}
/** Deadlines come only from the authorized snapshot and a validated as-of time.
 * Resolved cases cannot appear overdue. Invalid/absent timestamps are not guessed.
 */
export function isOverdueQualityCase(item: QualityCaseRecord, snapshotAt?: string): boolean {
  if (item.state === "RESOLVED" || !item.dueAt || !snapshotAt) return false;
  const due = Date.parse(item.dueAt);
  const asOf = Date.parse(snapshotAt);
  return Number.isFinite(due) && Number.isFinite(asOf) && due < asOf;
}
export function qualityQueueCount(records: readonly QualityCaseRecord[], snapshotAt?: string): Record<QualityQueue, number> {
  const count = { all: records.length, open: 0, review: 0, overdue: 0, unassigned: 0, resolved: 0 };
  for (const item of records) {
    if (item.state === "OPEN") count.open++;
    if (item.state === "IN_REVIEW") count.review++;
    if (isOverdueQualityCase(item, snapshotAt)) count.overdue++;
    if (!item.ownerUserId && item.state !== "RESOLVED") count.unassigned++;
    if (item.state === "RESOLVED") count.resolved++;
  }
  return count;
}
export function filterQualityQueue<T extends QualityCaseRecord>(
  records: readonly T[], queue: QualityQueue, search: string,
  searchable: (item:T) => readonly (string|undefined|null)[] = item => [item.summary],
  snapshotAt?: string,
): T[] {
  const terms = normalizeQualitySearch(search).toLocaleLowerCase().split(" ").filter(Boolean);
  return records.filter(item => {
    if (queue === "open" && item.state !== "OPEN") return false;
    if (queue === "review" && item.state !== "IN_REVIEW") return false;
    if (queue === "overdue" && !isOverdueQualityCase(item, snapshotAt)) return false;
    if (queue === "resolved" && item.state !== "RESOLVED") return false;
    if (queue === "unassigned" && (item.ownerUserId || item.state === "RESOLVED")) return false;
    if (terms.length === 0) return true;
    const text = searchable(item).filter(Boolean).join(" ").toLocaleLowerCase();
    return terms.every(term => text.includes(term));
  });
}
