import { normalizeJobsQueue } from "./jobs-queue";

/** Return location is derived only from validated queue identifiers and
 * encoded record IDs. No user-provided return URL or open redirect. */
export function jobsActionReturnPrefix(visitId: string, selectedJobQueue?: string): string {
  const queue = normalizeJobsQueue(selectedJobQueue);
  const params = new URLSearchParams();
  if (queue !== "all") params.set("queue", queue);
  if (visitId) params.set("job", visitId);
  const value = params.toString();
  return value ? value + "&" : "";
}

export function scheduleActionReturnPrefix(selectedScheduleQueue?: string): string {
  return selectedScheduleQueue === "unassigned" ? "queue=unassigned&" : "";
}
