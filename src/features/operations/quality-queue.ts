import { trustedQuoteInstant } from "./quote-validity-clock";
/** Quality triage is read-only over the authenticated staff snapshot. */
export const qualityQueueOptions = [
  { key: "all", label: "All cases" },
  { key: "open", label: "Open" },
  { key: "review", label: "In review" },
  { key: "overdue", label: "Overdue" },
  { key: "unverified", label: "Timing unverified" },
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
  // Date.parse may silently normalize impossible dates (for example Feb 30)
  // and accept unzoned, browser-local instants. A quality case may be shown
  // overdue only when BOTH persisted source instants are genuinely trusted.
  const due = trustedQuoteInstant(item.dueAt);
  const asOf = trustedQuoteInstant(snapshotAt);
  return due !== null && asOf !== null && due < asOf;
}
/** Unknown source deadlines are not "safe" or overdue; they need a
 * separate owner/dispatcher follow-up rather than being silently excluded.
 * When the snapshot clock itself is untrusted, every unresolved case has
 * unverified timing until a new authenticated read can be obtained.
 */
export function isUnverifiedQualityTiming(
  item: QualityCaseRecord, snapshotAt?: string,
): boolean {
  if (item.state === "RESOLVED") return false;
  return !item.dueAt || trustedQuoteInstant(item.dueAt) === null ||
    !snapshotAt || trustedQuoteInstant(snapshotAt) === null;
}

/** Shared, read-only attention order used by Today and the Quality queue.
 * We do not synthesize deadlines: unknown/invalid due times sort last.
 */
export function prioritizeQualityFollowUp<T extends QualityCaseRecord>(
  records: readonly T[],
  snapshotAt?: string,
): T[] {
  const stateWeight: Record<string, number> = { IN_REVIEW: 0, OPEN: 1, RESOLVED: 2 };
  const deadline = (caseItem: T) => {
    const parsed = trustedQuoteInstant(caseItem.dueAt);
    return parsed ?? Number.MAX_SAFE_INTEGER;
  };
  return [...records].sort((left, right) =>
    Number(isOverdueQualityCase(right, snapshotAt)) - Number(isOverdueQualityCase(left, snapshotAt))
    || (stateWeight[left.state] ?? 9) - (stateWeight[right.state] ?? 9)
    || deadline(left) - deadline(right)
    || left.id.localeCompare(right.id));
}

export function qualityQueueCount(records: readonly QualityCaseRecord[], snapshotAt?: string): Record<QualityQueue, number> {
  const count = { all: records.length, open: 0, review: 0, overdue: 0, unverified: 0, unassigned: 0, resolved: 0 };
  for (const item of records) {
    if (item.state === "OPEN") count.open++;
    if (item.state === "IN_REVIEW") count.review++;
    if (isOverdueQualityCase(item, snapshotAt)) count.overdue++;
    if (isUnverifiedQualityTiming(item, snapshotAt)) count.unverified++;
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
    if (queue === "unverified" && !isUnverifiedQualityTiming(item, snapshotAt)) return false;
    if (queue === "resolved" && item.state !== "RESOLVED") return false;
    if (queue === "unassigned" && (item.ownerUserId || item.state === "RESOLVED")) return false;
    if (terms.length === 0) return true;
    const text = searchable(item).filter(Boolean).join(" ").toLocaleLowerCase();
    return terms.every(term => text.includes(term));
  });
}
