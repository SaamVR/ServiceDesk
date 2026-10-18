import { createLocalDayKey } from "./staff-local-day";
import { trustedQuoteInstant } from "./quote-validity-clock";

export interface DispatchCoverageDay {
  key: string;
  weekday: string;
  monthDay: string;
  total: number;
  unassigned: number;
  underway: number;
}

/** A schedule day is a real Gregorian civil day, not just YYYY-MM-DD-shaped.
 * Date.UTC accepts overflow dates silently, so explicitly reject them.
 */
export function isValidCoverageDay(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return year >= 1 && month >= 1 && month <= 12 &&
    day >= 1 && day <= days[month - 1];
}

export function buildDispatchCoverageWeek<T extends { startAt?: string; crewId?: string; status: string }>(
  visits: readonly T[],
  snapshotAt: string,
  timeZone: string,
  startDay?: string,
): DispatchCoverageDay[] {
  // Never show seven fabricated empty days if the source clock or timezone
  // is invalid. Validating timestamp separately avoids Date.parse overflow.
  if (trustedQuoteInstant(snapshotAt) === null) return [];
  const localDayKey = createLocalDayKey(timeZone);
  const snapshotDay = localDayKey(snapshotAt);
  if (!snapshotDay) return [];
  const start = startDay ?? snapshotDay;
  if (!isValidCoverageDay(start)) return [];
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
    if (visit.status === "CANCELLED" || !visit.startAt ||
        trustedQuoteInstant(visit.startAt) === null) continue;
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
  if (from && from !== today && isValidCoverageDay(from)) params.set("from", from);
  if (queue === "unassigned") params.set("queue", "unassigned");
  if (isValidCoverageDay(day)) params.set("day", day);
  const value = params.toString();
  return value ? "?" + value : "?";
}
