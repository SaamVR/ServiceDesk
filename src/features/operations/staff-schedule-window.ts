import { createLocalDayKey } from "./staff-local-day";

/** Seven full business-calendar days, not 168 UTC hours (DST-safe). */
export interface ScheduleWindow {
  from: string;
  until: string;
  end: string;
  previous: string;
  next: string;
  today: string;
  isCurrent: boolean;
}
function isoUtcDay(date: Date) {
  return date.toISOString().slice(0, 10);
}
export function shiftBusinessDay(key: string, days: number): string {
  const date = new Date(key + "T00:00:00.000Z");
  date.setUTCDate(date.getUTCDate() + days);
  return isoUtcDay(date);
}
export function validateScheduleDay(input: string | undefined): string | undefined {
  if (!input || !/^\d{4}-\d{2}-\d{2}$/.test(input)) return undefined;
  const date = new Date(input + "T00:00:00.000Z");
  return Number.isFinite(date.getTime()) && isoUtcDay(date) === input ? input : undefined;
}
export function buildScheduleWindow(now: string, timeZone: string, requestedStart?: string): ScheduleWindow {
  const today = createLocalDayKey(timeZone)(now);
  if (!today) throw new Error("A valid authorized snapshot timestamp is required");
  const requested = validateScheduleDay(requestedStart);
  // Bound URL-supplied dates to a useful one-year planning horizon.
  const todayMillis = Date.parse(today + "T00:00:00.000Z");
  const requestMillis = requested ? Date.parse(requested + "T00:00:00.000Z") : NaN;
  const from = requested && Math.abs(requestMillis - todayMillis) <= 366 * 86400000 ? requested : today;
  return { from, until: shiftBusinessDay(from, 7), end: shiftBusinessDay(from, 6),
    previous: shiftBusinessDay(from, -7), next: shiftBusinessDay(from, 7),
    today, isCurrent: from === today };
}
export function scheduleWindowHref(from: string, queue: "all" | "unassigned", today: string): string {
  const params = new URLSearchParams();
  if (from !== today) params.set("from", from);
  if (queue === "unassigned") params.set("queue", "unassigned");
  return params.size ? "?" + params.toString() : "?";
}
export function scheduleWindowFeedbackPrefix(window: ScheduleWindow, queue: "all" | "unassigned"): string {
  const params = new URLSearchParams();
  if (!window.isCurrent) params.set("from", window.from);
  if (queue === "unassigned") params.set("queue", "unassigned");
  const query = params.toString();
  return query ? query + "&" : "";
}
/** Filter only authorized records. Status transitions are never inferred. */
export function filterScheduleWindow<T extends {startAt: string; status: string}>(
  records: readonly T[], timeZone: string, window: ScheduleWindow,
): T[] {
  const localDay = createLocalDayKey(timeZone);
  return records.filter((row) => {
    const day = localDay(row.startAt);
    return day !== undefined && day >= window.from && day < window.until && row.status !== "CANCELLED";
  }).sort((a,b)=>Date.parse(a.startAt)-Date.parse(b.startAt));
}
