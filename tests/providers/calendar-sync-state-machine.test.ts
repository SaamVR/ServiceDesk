import { describe, expect, test } from "vitest";
import {
  normalizeGoogleCalendarEventBusy,
  runGoogleCalendarSync,
  type CalendarEventPageFetcher,
  type GoogleCalendarProviderEvent,
} from "../../src/server/integrations/google-calendar/sync";

const baseState = {
  workspaceId: "ws-clearnest",
  crewId: "crew-1",
  calendarId: "primary@example.test",
  stale: false,
};

function event(id: string, overrides: Partial<GoogleCalendarProviderEvent> = {}): GoogleCalendarProviderEvent {
  return {
    id,
    status: "confirmed",
    start: { dateTime: "2026-11-01T10:00:00.000Z" },
    end: { dateTime: "2026-11-01T11:00:00.000Z" },
    summary: "Customer private event",
    description: "Do not leak this description",
    ...overrides,
  };
}

describe("Google Calendar sync state machine", () => {
  test("runs an initial full sync across page tokens and stores next sync token", async () => {
    const calls: Array<Parameters<CalendarEventPageFetcher>[0]> = [];
    const fetchPage: CalendarEventPageFetcher = async (input) => {
      calls.push(input);
      if (!input.pageToken) {
        return { ok: true, value: { events: [event("evt-1")], nextPageToken: "page-2" } };
      }
      return { ok: true, value: { events: [event("evt-2")], nextSyncToken: "sync-next" } };
    };

    const result = await runGoogleCalendarSync({
      state: baseState,
      now: "2026-10-04T07:55:00.000Z",
      fullSyncRange: { timeMin: "2026-10-04T00:00:00.000Z", timeMax: "2026-12-04T00:00:00.000Z" },
      fetchPage,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.mode).toBe("FULL_SYNC");
      expect(result.value.busy).toHaveLength(2);
      expect(result.value.nextState).toMatchObject({ syncToken: "sync-next", stale: false, lastSyncedAt: "2026-10-04T07:55:00.000Z" });
      expect(result.value.canMutateBookingTruth).toBe(false);
    }
    expect(calls.map((call) => ({ syncToken: call.syncToken, pageToken: call.pageToken }))).toEqual([
      { syncToken: undefined, pageToken: undefined },
      { syncToken: undefined, pageToken: "page-2" },
    ]);
  });

  test("runs incremental sync using the existing sync token", async () => {
    const calls: Array<Parameters<CalendarEventPageFetcher>[0]> = [];
    const fetchPage: CalendarEventPageFetcher = async (input) => {
      calls.push(input);
      return { ok: true, value: { events: [event("evt-incremental")], nextSyncToken: "sync-new" } };
    };

    const result = await runGoogleCalendarSync({
      state: { ...baseState, syncToken: "sync-old", lastSyncedAt: "2026-10-04T07:30:00.000Z" },
      now: "2026-10-04T07:55:00.000Z",
      fetchPage,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.mode).toBe("INCREMENTAL_SYNC");
      expect(result.value.nextState.syncToken).toBe("sync-new");
    }
    expect(calls[0]).toMatchObject({ syncToken: "sync-old", pageToken: undefined });
  });

  test("turns expired provider sync token into a full-rebuild-required plan", async () => {
    const result = await runGoogleCalendarSync({
      state: { ...baseState, syncToken: "expired" },
      now: "2026-10-04T07:55:00.000Z",
      fetchPage: async () => ({ ok: false, code: "GOOGLE_CALENDAR_SYNC_TOKEN_EXPIRED", message: "Gone" }),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.mode).toBe("FULL_REBUILD_REQUIRED");
      expect(result.value.nextState).toMatchObject({ stale: true, syncToken: undefined });
      expect(result.value.busy).toEqual([]);
      expect(result.value.notes.join(" ")).toContain("full rebuild");
    }
  });

  test("normalizes external busy without leaking summary or description", () => {
    const busy = normalizeGoogleCalendarEventBusy("cal-private", event("private-event"));

    expect(busy).toEqual({
      calendarId: "cal-private",
      startAt: "2026-11-01T10:00:00.000Z",
      endAt: "2026-11-01T11:00:00.000Z",
      source: "EXTERNAL_BUSY",
      freshness: "FRESH",
    });
    expect(JSON.stringify(busy)).not.toContain("Customer private event");
    expect(JSON.stringify(busy)).not.toContain("Do not leak");
  });
});
