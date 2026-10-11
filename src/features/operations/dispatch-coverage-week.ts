import { createLocalDayKey } from "./staff-local-day";

export interface DispatchCoverageDay {
  key: string;
  weekday: string;
  monthDay: string;
  total: number;
  unassigned: number;
  underway: number;
}

export function buildDispatchCoverageWeek<T extends { startAt?: string; crewId?: string; status: string }>(
  visits: readonly T[],
  snapshotAt: string,
  timeZone: string,
  startDay?: string,
): DispatchCoverageDay[] {
  const localDayKey = createLocalDayKey(timeZone);
  const start = startDay ?? localDayKey(snapshotAt);
  if (!start) return [];
  const [year, month, day] = start.split("-").map(Number);
  const dates: DispatchCoverageDay[] = Array.from({ length: 7 }, (_, offset) => {
    // Calendar-day arithmetic in UTC avoids local DST shifts; visit grouping
    // uses the business timezone, not the reader's browser timezone.
    const date = new Date(Date.UTC(year, month - 1, day + offset));
    return {
      key: date.toISOString().slice(0, 10),
      weekday: new Intl.DateTimeFormat("en", { weekday: "short", timeZone: "UTC" }).format(date),
      monthDay: new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" }).format(date),
      total: 0,
      unassigned: 0,
      underway: 0,
    };
  });
  const byDate = new Map(dates.map((item) => [item.key, item]));
  for (const visit of visits) {
    if (visit.status === "CANCELLED" || !visit.startAt) continue;
    const date = byDate.get(localDayKey(visit.startAt) ?? "");
    if (!date) continue;
    date.total += 1;
    if (!visit.crewId) date.unassigned += 1;
    if (visit.status === "EN_ROUTE" || visit.status === "IN_PROGRESS") date.underway += 1;
  }
  return dates;
}

export function normalizeCoverageDay(input: string | undefined, days: readonly DispatchCoverageDay[]): string | undefined {
  return days.some((day) => day.key === input) ? input : undefined;
}

export function scheduleCoverageHref(queue: string | undefined, day?: string, from?: string, today?: string): string {
  const params = new URLSearchParams();
  if (from && from !== today && /^\\d{4}-\\d{2}-\\d{2}$/.test(from)) params.set("from", from);
  if (queue === "unassigned") params.set("queue", "unassigned");
  if (day && /^\d{4}-\d{2}-\d{2}$/.test(day)) params.set("day", day);
  const value = params.toString();
  return value ? "?" + value : "?";
}
