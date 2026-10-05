import type { VisitDTO } from "@/contracts";

export type OperationalTimeZoneSource = "WORKSPACE" | "FALLBACK_UTC";

export interface ResolvedOperationalTimeZone {
  timeZone: string;
  source: OperationalTimeZoneSource;
}

export interface VisitWindowPresentation {
  windowLabel: string;
  dateLabel: string;
  timeZoneLabel: string;
  timeZone: string;
  timeZoneSource: OperationalTimeZoneSource;
}

function validTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: value }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

export function resolveOperationalTimeZone(workspaceTimeZone?: string): ResolvedOperationalTimeZone {
  const candidate = workspaceTimeZone?.trim();
  if (candidate && validTimeZone(candidate)) {
    return { timeZone: candidate, source: "WORKSPACE" };
  }
  return { timeZone: "UTC", source: "FALLBACK_UTC" };
}

function visitEndAt(visit: Pick<VisitDTO, "startAt" | "serviceMinutes" | "bufferMinutes">): Date {
  return new Date(new Date(visit.startAt).getTime() + (visit.serviceMinutes + visit.bufferMinutes) * 60_000);
}

function timeFormatter(timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  });
}

function dateFormatter(timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone,
  });
}

function dateKey(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).formatToParts(value);
  const byType = new Map(parts.map((part) => [part.type, part.value]));
  return `${byType.get("year")}-${byType.get("month")}-${byType.get("day")}`;
}

export function formatOperationalTime(value: string, workspaceTimeZone?: string): string {
  const resolved = resolveOperationalTimeZone(workspaceTimeZone);
  return timeFormatter(resolved.timeZone).format(new Date(value));
}

export function formatVisitWindow(
  visit: Pick<VisitDTO, "startAt" | "serviceMinutes" | "bufferMinutes">,
  workspaceTimeZone?: string,
): VisitWindowPresentation {
  const resolved = resolveOperationalTimeZone(workspaceTimeZone);
  const start = new Date(visit.startAt);
  const end = visitEndAt(visit);
  const time = timeFormatter(resolved.timeZone);

  return {
    windowLabel: `${time.format(start)}–${time.format(end)}`,
    dateLabel: dateFormatter(resolved.timeZone).format(start),
    timeZoneLabel: resolved.timeZone,
    timeZone: resolved.timeZone,
    timeZoneSource: resolved.source,
  };
}

export function isVisitOnOperationalDay(
  visit: Pick<VisitDTO, "startAt">,
  now: string,
  workspaceTimeZone?: string,
): boolean {
  const resolved = resolveOperationalTimeZone(workspaceTimeZone);
  return dateKey(new Date(visit.startAt), resolved.timeZone) === dateKey(new Date(now), resolved.timeZone);
}
