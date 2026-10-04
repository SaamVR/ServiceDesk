import { describe, expect, test } from "vitest";
import { listGoogleCalendarEventsPage, type GoogleCalendarHttpTransport } from "../../src/server/integrations/google-calendar/rest-client";

const config = {
  calendarApiBaseUrl: "https://www.googleapis.com/calendar/v3",
  accessToken: "calendar-secret-token",
  timeoutMs: 1000,
};

describe("Google Calendar REST event list sync", () => {
  test("lists initial sync page with time bounds and redacts private event text from normalized output", async () => {
    let captured: Parameters<GoogleCalendarHttpTransport>[0] | undefined;
    const http: GoogleCalendarHttpTransport = async (request) => {
      captured = request;
      return {
        status: 200,
        body: JSON.stringify({
          items: [
            {
              id: "evt-1",
              status: "confirmed",
              summary: "Customer dentist appointment",
              description: "Private description",
              start: { dateTime: "2026-11-01T09:00:00.000Z" },
              end: { dateTime: "2026-11-01T10:00:00.000Z" },
            },
          ],
          nextPageToken: "page-2",
        }),
      };
    };

    const result = await listGoogleCalendarEventsPage(
      config,
      { calendarId: "crew@example.test", timeMin: "2026-11-01T00:00:00.000Z", timeMax: "2026-12-01T00:00:00.000Z" },
      http,
    );

    expect(result.ok).toBe(true);
    expect(captured?.method).toBe("GET");
    expect(captured?.url).toContain("/calendars/crew%40example.test/events");
    expect(captured?.url).toContain("singleEvents=true");
    expect(captured?.url).toContain("timeMin=2026-11-01T00%3A00%3A00.000Z");
    expect(captured?.headers.authorization).toBe("Bearer calendar-secret-token");
    if (result.ok) {
      expect(result.value.nextPageToken).toBe("page-2");
      expect(result.value.events[0]).toMatchObject({ id: "evt-1", status: "confirmed" });
      expect(JSON.stringify(result.value.events)).toContain("Customer dentist appointment");
    }
  });

  test("lists incremental sync page with sync token and page token", async () => {
    let capturedUrl = "";
    const result = await listGoogleCalendarEventsPage(
      config,
      { calendarId: "crew@example.test", syncToken: "sync-old", pageToken: "page-2" },
      async (request) => {
        capturedUrl = request.url;
        return { status: 200, body: JSON.stringify({ items: [], nextSyncToken: "sync-new" }) };
      },
    );

    expect(result.ok).toBe(true);
    expect(capturedUrl).toContain("syncToken=sync-old");
    expect(capturedUrl).toContain("pageToken=page-2");
    if (result.ok) expect(result.value.nextSyncToken).toBe("sync-new");
  });

  test("normalizes expired sync token into full rebuild error", async () => {
    const result = await listGoogleCalendarEventsPage(
      config,
      { calendarId: "crew@example.test", syncToken: "expired" },
      async () => ({ status: 410, body: JSON.stringify({ error: { message: "sync token expired" } }) }),
    );

    expect(result).toMatchObject({ ok: false, code: "GOOGLE_CALENDAR_SYNC_TOKEN_EXPIRED" });
    expect(JSON.stringify(result)).not.toContain("calendar-secret-token");
  });
});
