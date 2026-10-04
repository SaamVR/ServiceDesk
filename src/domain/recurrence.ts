export type RecurrenceFrequency = "WEEKLY" | "FORTNIGHTLY" | "MONTHLY";

export interface NextRecurrenceDateInput {
  current: string;
  frequency: RecurrenceFrequency;
  anchorDay?: number;
}

export function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`));
}

function parseIsoDate(value: string): { year: number; month: number; day: number } {
  if (!isIsoDate(value)) throw new Error(`Invalid ISO date: ${value}`);
  const [year, month, day] = value.split("-").map(Number);
  const roundTrip = new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
  if (roundTrip !== value) throw new Error(`Invalid calendar date: ${value}`);
  return { year, month, day };
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function addDays(date: string, days: number): string {
  const { year, month, day } = parseIsoDate(date);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  return utc.toISOString().slice(0, 10);
}

export function nextRecurrenceDate(input: NextRecurrenceDateInput): string {
  const { year, month, day } = parseIsoDate(input.current);
  if (input.frequency === "WEEKLY") return addDays(input.current, 7);
  if (input.frequency === "FORTNIGHTLY") return addDays(input.current, 14);
  if (input.frequency !== "MONTHLY") throw new Error(`Unsupported recurrence frequency: ${input.frequency}`);

  const anchorDay = input.anchorDay ?? day;
  if (!Number.isInteger(anchorDay) || anchorDay < 1 || anchorDay > 31) {
    throw new Error(`Invalid monthly anchor day: ${anchorDay}`);
  }

  const nextMonthIndex = month; // zero-based Date.UTC month index for the following month.
  const next = new Date(Date.UTC(year, nextMonthIndex, 1));
  const nextYear = next.getUTCFullYear();
  const nextMonth = next.getUTCMonth() + 1;
  const clampedDay = Math.min(anchorDay, daysInMonth(nextYear, nextMonth));
  return new Date(Date.UTC(nextYear, nextMonth - 1, clampedDay)).toISOString().slice(0, 10);
}

export function assertValidTimeZone(timeZone: string): void {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
  } catch {
    throw new Error(`Invalid IANA timezone: ${timeZone}`);
  }
}

function zoneParts(instantMs: number, timeZone: string): { year: number; month: number; day: number; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(instantMs));

  const value = (type: string) => {
    const part = parts.find((item) => item.type === type)?.value;
    if (!part) throw new Error(`Missing ${type} while formatting ${timeZone}`);
    return Number(part);
  };

  return { year: value("year"), month: value("month"), day: value("day"), hour: value("hour"), minute: value("minute") };
}

function offsetMinutesAt(instantMs: number, timeZone: string): number {
  const parts = zoneParts(instantMs, timeZone);
  const localAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  return Math.round((localAsUtc - instantMs) / 60000);
}

export function localDateTimeToUtcIso(date: string, localStartTime: string, timeZone: string): string {
  assertValidTimeZone(timeZone);
  const { year, month, day } = parseIsoDate(date);
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(localStartTime);
  if (!match) throw new Error(`Invalid local start time: ${localStartTime}`);
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] ?? "0");
  if (hour > 23 || minute > 59 || second > 59) throw new Error(`Invalid local start time: ${localStartTime}`);

  const naiveUtcMs = Date.UTC(year, month - 1, day, hour, minute, second);
  const candidates = [
    naiveUtcMs - offsetMinutesAt(naiveUtcMs, timeZone) * 60_000,
    naiveUtcMs - offsetMinutesAt(naiveUtcMs - 60 * 60_000, timeZone) * 60_000,
    naiveUtcMs - offsetMinutesAt(naiveUtcMs + 60 * 60_000, timeZone) * 60_000,
  ];

  const matched = candidates.find((candidate) => {
    const parts = zoneParts(candidate, timeZone);
    return parts.year === year && parts.month === month && parts.day === day && parts.hour === hour && parts.minute === minute;
  });

  if (matched === undefined) {
    throw new Error(`Local time does not resolve cleanly in ${timeZone}: ${date} ${localStartTime}`);
  }

  return new Date(matched).toISOString();
}

export function shouldCompleteRecurrence(nextOccurrenceOn: string | undefined, endsOn: string | undefined, generatedOccurrences: number, maxOccurrences: number | undefined): boolean {
  if (!nextOccurrenceOn) return true;
  if (endsOn && nextOccurrenceOn > endsOn) return true;
  return maxOccurrences !== undefined && generatedOccurrences >= maxOccurrences;
}
