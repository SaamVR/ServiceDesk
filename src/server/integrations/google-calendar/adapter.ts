import type { Result, VisitDTO } from "../../../contracts";
import type { CommandMeta } from "../../../contracts";
import type { CalendarAdapter, CalendarBusyRange, CalendarSyncState, RedactedProviderEvidence } from "../types";

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
