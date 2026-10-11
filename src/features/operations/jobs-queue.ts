export type JobsQueue = "all" | "needs-crew" | "underway" | "review" | "closed";
export const jobsQueueOptions: ReadonlyArray<{ key: JobsQueue; label: string }> = [
  { key: "all", label: "All jobs" },
  { key: "needs-crew", label: "Need crew" },
  { key: "underway", label: "Underway" },
  { key: "review", label: "Awaiting review" },
  { key: "closed", label: "Closed" },
];

export function normalizeJobsQueue(input?: string): JobsQueue {
  return jobsQueueOptions.some((item) => item.key === input) ? input as JobsQueue : "all";
}

export function filterJobsQueue<T extends { status: string; crewId?: string }>(
  visits: readonly T[],
  queue: JobsQueue,
): T[] {
  if (queue === "all") return [...visits];
  return visits.filter((visit) => {
    const closed = visit.status === "COMPLETED" || visit.status === "CANCELLED";
    if (queue === "closed") return closed;
    if (closed) return false;
    if (queue === "needs-crew") return !visit.crewId;
    if (queue === "underway") return visit.status === "EN_ROUTE" || visit.status === "IN_PROGRESS";
    return visit.status === "PENDING_REVIEW";
  });
}

export function jobsQueueHref(queue: JobsQueue, visitId?: string, search?: string): string {
  const params = new URLSearchParams();
  if (queue !== "all") params.set("queue", queue);
  if (visitId) params.set("job", visitId);
 if (normalizeJobsSearch(search)) params.set("search", normalizeJobsSearch(search));
  if (normalizeJobsSearch(search)) params.set("search", normalizeJobsSearch(search));
  const query = params.toString();
  return query ? "?" + query : "?";
}

/** One pass each over evidence and checklist. No repeated array scans per rendered job. */
export function indexJobProgress<E extends { visitId: string }, C extends { visitId: string; completed: boolean }>(
  evidence: readonly E[],
  checklist: readonly C[],
): Map<string, { evidence: number; checklist: number; completed: number }> {
  const byVisit = new Map<string, { evidence: number; checklist: number; completed: number }>();
  function entry(visitId: string) {
    const previous = byVisit.get(visitId);
    if (previous) return previous;
    const value = { evidence: 0, checklist: 0, completed: 0 };
    byVisit.set(visitId, value);
    return value;
  }
  for (const item of evidence) entry(item.visitId).evidence += 1;
  for (const item of checklist) {
    const count = entry(item.visitId);
    count.checklist += 1;
    if (item.completed) count.completed += 1;
  }
  return byVisit;
}

/** Redirect context must survive a mutation (including success/failure).
 * The action may move a visit out of the selected queue; preserve the filter
 * but let the viewer choose the next visible job on revalidation.
 */
export function jobsActionFeedbackPrefix(queue: JobsQueue, visitId: string, search?: string): string {
 const params = new URLSearchParams();
 if (queue !== "all") params.set("queue", queue);
 params.set("job", visitId);
 if (normalizeJobsSearch(search)) params.set("search", normalizeJobsSearch(search));
 return params.toString() + "&";
}

/** Search only the current workspace's authorized snapshot fields. */
export function normalizeJobsSearch(raw?: string): string {
  return (raw ?? "").slice(0, 200).trim().replace(/\s+/g, " ").slice(0, 90);
}
export function filterJobsSearch<T>(
  visits: readonly T[],
  query: string,
  fields: (visit: T) => readonly (string | null | undefined)[],
): T[] {
  const terms = normalizeJobsSearch(query).toLocaleLowerCase().split(" ").filter(Boolean);
  if (!terms.length) return [...visits];
  return visits.filter((visit) => {
    const text = fields(visit).map((value) => (value ?? "").toLocaleLowerCase());
    return terms.every((term) => text.some((part) => part.includes(term)));
  });
}
