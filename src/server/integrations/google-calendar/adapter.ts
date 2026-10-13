import type { Result, VisitDTO } from "../../../contracts";
import type { CommandMeta } from "../../../contracts";
import type { CalendarAdapter, CalendarBusyRange, CalendarSyncState, RedactedProviderEvidence } from "../types";
import type { GoogleCalendarConnectionPolicy } from "./oauth";

export type CalendarFreshnessReason =
  | "CALENDAR_NOT_CONFIGURED"
  | "CALENDAR_RECONNECT_REQUIRED"
  | "CALENDAR_STALE_REQUIRES_REFRESH"
  | "CALENDAR_EVENT_WRITE_UNAVAILABLE"
  | "CALENDAR_BUSY_LOOKUP_FAILED";

export interface CalendarBusyFreshnessResult {
  busy: CalendarBusyRange[];
  availabilityFresh: boolean;
  instantConfirmationAllowed: boolean;
  reason?: CalendarFreshnessReason;
}

function evidence(notes: string[], controlledId?: string): RedactedProviderEvidence {
  return {
    provider: "GOOGLE_CALENDAR",
    mode: "FIXTURE",
    verification: "CONTRACT_TESTED",
    capturedAt: new Date().toISOString(),
    controlledId,
    notes,
  };
}

function visitEnd(visit: VisitDTO): string {
  return new Date(new Date(visit.startAt).getTime() + (visit.serviceMinutes + visit.bufferMinutes) * 60_000).toISOString();
}

function unavailableReason(policy: GoogleCalendarConnectionPolicy): CalendarFreshnessReason | null {
  if (policy.status === "NOT_CONFIGURED") return "CALENDAR_NOT_CONFIGURED";
  if (policy.status === "REAUTH_REQUIRED") return "CALENDAR_RECONNECT_REQUIRED";
  if (policy.reason === "ACCESS_TOKEN_EXPIRED") return "CALENDAR_STALE_REQUIRES_REFRESH";
  if (!policy.canReadBusy) return "CALENDAR_RECONNECT_REQUIRED";
  return null;
}

/** Untrusted provider busy results cannot make a booking instantly
 * confirmable. Explicit time zone is required to avoid DST ambiguity.
 */
function verifiedBusyInterval(value: CalendarBusyRange): boolean {
  if (!value || typeof value !== "object" ||
      !["FRESH", "STALE"].includes(value.freshness) ||
      !["APP_MANAGED", "EXTERNAL_BUSY"].includes(value.source) ||
      typeof value.calendarId !== "string" || !value.calendarId.trim() ||
      value.calendarId.length > 512 ||
      typeof value.startAt !== "string" || typeof value.endAt !== "string" ||
      !/(?:Z|[+-]\d{2}:\d{2})$/i.test(value.startAt) ||
      !/(?:Z|[+-]\d{2}:\d{2})$/i.test(value.endAt)) return false;
  const start = Date.parse(value.startAt);
  const end = Date.parse(value.endAt);
  return Number.isFinite(start) && Number.isFinite(end) && end > start;
}

export async function listCalendarBusyWithFreshness(
  adapter: CalendarAdapter,
  policy: GoogleCalendarConnectionPolicy,
  range: { from: string; to: string },
  crewId: string,
): Promise<Result<CalendarBusyFreshnessResult>> {
  const blockedReason = unavailableReason(policy);
  if (blockedReason) {
    return {
      ok: true,
      value: {
        busy: [],
        availabilityFresh: false,
        instantConfirmationAllowed: false,
        reason: blockedReason,
      },
    };
  }

  // A thrown provider adapter exception is not proof of an empty calendar.
  // Fail closed just like an explicit provider error.
  let busy: Awaited<ReturnType<CalendarAdapter["listBusy"]>>;
  try { busy = await adapter.listBusy(range, crewId); }
  catch {
    return { ok: true, value: {
      busy: [], availabilityFresh: false, instantConfirmationAllowed: false,
      reason: "CALENDAR_BUSY_LOOKUP_FAILED",
    } };
  }
  if (!busy.ok) {
    return {
      ok: true,
      value: {
        busy: [],
        availabilityFresh: false,
        instantConfirmationAllowed: false,
        reason: "CALENDAR_BUSY_LOOKUP_FAILED",
      },
    };
  }

  if (!Array.isArray(busy.value) || busy.value.length > 5000 ||
      !busy.value.every(verifiedBusyInterval)) {
    return { ok: true, value: {
      busy: [], availabilityFresh: false, instantConfirmationAllowed: false,
      reason: "CALENDAR_BUSY_LOOKUP_FAILED",
    } };
  }

  const hasStaleBlock = busy.value.some((block) => block.freshness === "STALE");
  if (hasStaleBlock) {
    return {
      ok: true,
      value: {
        busy: busy.value,
        availabilityFresh: false,
        instantConfirmationAllowed: false,
        reason: "CALENDAR_STALE_REQUIRES_REFRESH",
      },
    };
  }

  if (!policy.canCreateEvents) {
    return {
      ok: true,
      value: {
        busy: busy.value,
        availabilityFresh: true,
        instantConfirmationAllowed: false,
        reason: "CALENDAR_EVENT_WRITE_UNAVAILABLE",
      },
    };
  }

  return {
    ok: true,
    value: {
      busy: busy.value,
      availabilityFresh: true,
      instantConfirmationAllowed: true,
    },
  };
}

export class FixtureCalendarAdapter implements CalendarAdapter {
  private readonly events = new Map<string, { eventId: string; visit: VisitDTO; cancelled: boolean }>();
  private readonly externalBusy: CalendarBusyRange[];

  constructor(externalBusy: CalendarBusyRange[] = []) {
    this.externalBusy = externalBusy;
  }

  async createOrUpdate(visit: VisitDTO): Promise<Result<{ providerEventId: string; evidence: RedactedProviderEvidence }>> {
    const existing = this.events.get(visit.id);
    const providerEventId = existing?.eventId ?? `gcal_fixture_${visit.id}`;
    this.events.set(visit.id, { eventId: providerEventId, visit, cancelled: false });
    return { ok: true, value: { providerEventId, evidence: evidence(["Fixture Calendar create/update; controlled Google calendar event still required."], providerEventId) } };
  }

  async cancel(visit: VisitDTO, _meta: CommandMeta): Promise<Result<{ providerEventId: string; evidence: RedactedProviderEvidence }>> {
    const existing = this.events.get(visit.id);
    if (!existing) return { ok: false, code: "CALENDAR_EVENT_NOT_FOUND", message: "No mapped fixture event exists for this visit." };
    this.events.set(visit.id, { ...existing, cancelled: true });
    return { ok: true, value: { providerEventId: existing.eventId, evidence: evidence(["Fixture Calendar cancellation recorded."], existing.eventId) } };
  }

  async listBusy(range: { from: string; to: string }, crewId: string): Promise<Result<CalendarBusyRange[]>> {
    const from = new Date(range.from).getTime();
    const to = new Date(range.to).getTime();
    const busy: CalendarBusyRange[] = [];

    for (const entry of this.events.values()) {
      if (entry.cancelled || entry.visit.crewId !== crewId) continue;
      const start = new Date(entry.visit.startAt).getTime();
      const end = new Date(visitEnd(entry.visit)).getTime();
      if (start < to && end > from) {
        busy.push({ calendarId: crewId, startAt: entry.visit.startAt, endAt: visitEnd(entry.visit), source: "APP_MANAGED", freshness: "FRESH" });
      }
    }

    busy.push(
      ...this.externalBusy.filter((block) => {
        const start = new Date(block.startAt).getTime();
        const end = new Date(block.endAt).getTime();
        return block.calendarId === crewId && start < to && end > from;
      }),
    );

    return { ok: true, value: busy };
  }

  async recoverSync(state: CalendarSyncState): Promise<Result<CalendarSyncState>> {
    if (state.syncToken === "expired") {
      return { ok: true, value: { ...state, syncToken: undefined, stale: true, lastSyncedAt: new Date().toISOString() } };
    }
    return { ok: true, value: { ...state, stale: false, lastSyncedAt: new Date().toISOString() } };
  }
}
