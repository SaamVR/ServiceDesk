import { describe, expect, test } from "vitest";
import {
  deleteGoogleCalendarEvent,
  freeBusyGoogleCalendar,
  getGoogleCalendarEvent,
  insertGoogleCalendarEvent,
  patchGoogleCalendarEvent,
  redactedGoogleCalendarRequestSummary,
  type GoogleCalendarHttpTransport,
} from "../../src/server/integrations/google-calendar/rest-client";

const config = {
  calendarApiBaseUrl: "https://www.googleapis.com/calendar/v3",
  accessToken: "secret-google-access-token",
  timeoutMs: 1000,
};

function transport(status: number, body: unknown, capture?: (input: Parameters<GoogleCalendarHttpTransport>[0]) => void): GoogleCalendarHttpTransport {
  return async (input) => {
    capture?.(input);
    return { status, body: typeof body === "string" ? body : JSON.stringify(body) };
  };
}

describe("Google Calendar REST client", () => {
  test("queries FreeBusy with encoded calendar IDs and redacted authorization", async () => {
    let request: Parameters<GoogleCalendarHttpTransport>[0] | undefined;
    const result = await freeBusyGoogleCalendar(
      config,
      {
        calendarIds: ["primary", "crew/calendar@example.com"],
        timeMin: "2026-10-04T09:00:00.000Z",
        timeMax: "2026-10-04T12:00:00.000Z",
      },
      transport(
        200,
        {
          calendars: {
            primary: { busy: [{ start: "2026-10-04T10:00:00.000Z", end: "2026-10-04T10:30:00.000Z" }] },
            "crew/calendar@example.com": { busy: [] },
          },
        },
        (input) => {
          request = input;
        },
      ),
    );

    expect(result.ok).toBe(true);
    expect(request?.method).toBe("POST");
    expect(request?.url).toBe("https://www.googleapis.com/calendar/v3/freeBusy");
    expect(request?.headers.authorization).toBe("Bearer secret-google-access-token");
    expect(JSON.parse(request?.body ?? "{}")).toMatchObject({
      timeMin: "2026-10-04T09:00:00.000Z",
      timeMax: "2026-10-04T12:00:00.000Z",
      items: [{ id: "primary" }, { id: "crew/calendar@example.com" }],
    });
    if (result.ok) {
      expect(result.value).toEqual([
        { calendarId: "primary", startAt: "2026-10-04T10:00:00.000Z", endAt: "2026-10-04T10:30:00.000Z", source: "EXTERNAL_BUSY", freshness: "FRESH" },
      ]);
    }
    expect(JSON.stringify(redactedGoogleCalendarRequestSummary(request!))).not.toContain("secret-google-access-token");
  });

  test("inserts, patches, gets, and deletes events through encoded event paths", async () => {
    const calls: Array<Parameters<GoogleCalendarHttpTransport>[0]> = [];
    const ok = transport(200, { id: "event-1", status: "confirmed" }, (input) => calls.push(input));

    const insert = await insertGoogleCalendarEvent(
      config,
      "crew/calendar@example.com",
      { summary: "Service visit", startAt: "2026-10-04T09:00:00.000Z", endAt: "2026-10-04T12:00:00.000Z", timeZone: "Europe/London", externalId: "visit-1" },
      ok,
    );
    const patch = await patchGoogleCalendarEvent(config, "crew/calendar@example.com", "event/1", { summary: "Updated", startAt: "2026-10-04T10:00:00.000Z", endAt: "2026-10-04T13:00:00.000Z", timeZone: "Europe/London" }, ok);
    const get = await getGoogleCalendarEvent(config, "crew/calendar@example.com", "event/1", ok);
    const deleted = await deleteGoogleCalendarEvent(config, "crew/calendar@example.com", "event/1", transport(204, "", (input) => calls.push(input)));

    expect(insert).toMatchObject({ ok: true, value: { providerEventId: "event-1" } });
    expect(patch).toMatchObject({ ok: true, value: { providerEventId: "event-1" } });
    expect(get).toMatchObject({ ok: true, value: { providerEventId: "event-1", cancelled: false } });
    expect(deleted).toMatchObject({ ok: true, value: { providerEventId: "event/1" } });
    expect(calls.map((call) => call.method)).toEqual(["POST", "PATCH", "GET", "DELETE"]);
    expect(calls[1].url).toContain("/calendars/crew%2Fcalendar%40example.com/events/event%2F1");
  });

  test("normalizes Google Calendar provider failures", async () => {
    const auth = await freeBusyGoogleCalendar(config, { calendarIds: ["primary"], timeMin: "2026-10-04T09:00:00.000Z", timeMax: "2026-10-04T10:00:00.000Z" }, transport(401, { error: { message: "expired" } }));
    const scope = await freeBusyGoogleCalendar(config, { calendarIds: ["primary"], timeMin: "2026-10-04T09:00:00.000Z", timeMax: "2026-10-04T10:00:00.000Z" }, transport(403, { error: { message: "scope" } }));
    const conflict = await patchGoogleCalendarEvent(config, "primary", "event-1", { startAt: "2026-10-04T09:00:00.000Z", endAt: "2026-10-04T10:00:00.000Z" }, transport(409, { error: { message: "conflict" } }));
    const syncExpired = await getGoogleCalendarEvent(config, "primary", "event-1", transport(410, { error: { message: "gone" } }));
    const rate = await getGoogleCalendarEvent(config, "primary", "event-1", transport(429, { error: { message: "slow" } }));
    const server = await getGoogleCalendarEvent(config, "primary", "event-1", transport(503, { error: { message: "down" } }));

    expect(auth).toMatchObject({ ok: false, code: "GOOGLE_CALENDAR_ACCESS_TOKEN_EXPIRED" });
    expect(scope).toMatchObject({ ok: false, code: "GOOGLE_CALENDAR_INSUFFICIENT_SCOPE" });
    expect(conflict).toMatchObject({ ok: false, code: "GOOGLE_CALENDAR_CONFLICT" });
    expect(syncExpired).toMatchObject({ ok: false, code: "GOOGLE_CALENDAR_SYNC_TOKEN_EXPIRED" });
    expect(rate).toMatchObject({ ok: false, code: "GOOGLE_CALENDAR_RATE_LIMITED" });
    expect(server).toMatchObject({ ok: false, code: "GOOGLE_CALENDAR_TRANSIENT_FAILURE" });
  });

  test("rejects malformed provider responses and timeouts without leaking tokens", async () => {
    const malformed = await getGoogleCalendarEvent(config, "primary", "event-1", transport(200, { status: "confirmed" }));
    const timeout = await getGoogleCalendarEvent(config, "primary", "event-1", async () => {
      const error = new Error("timeout");
      error.name = "AbortError";
      throw error;
    });

    expect(malformed).toMatchObject({ ok: false, code: "GOOGLE_CALENDAR_INVALID_RESPONSE" });
    expect(timeout).toMatchObject({ ok: false, code: "GOOGLE_CALENDAR_TIMEOUT" });
    expect(JSON.stringify(timeout)).not.toContain("secret-google-access-token");
  });
});
