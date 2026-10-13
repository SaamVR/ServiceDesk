import { describe, expect, test } from "vitest";
import { listGoogleCalendarEventsPage } from "../../src/server/integrations/google-calendar/rest-sync";
import type { GoogleCalendarHttpTransport } from "../../src/server/integrations/google-calendar/rest-client";

const config = {
  calendarApiBaseUrl: "https://www.googleapis.com/calendar/v3",
  accessToken: "calendar-secret-token",
  timeoutMs: 1000,
};

describe("Google Calendar REST event list sync", () => {
  test("lists initial sync page with time bounds and preserves raw event only for sync normalization", async () => {
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
      expect(JSON.stringify(result.value.redactedSummary)).not.toContain("Customer dentist appointment");
      expect(JSON.stringify(result.value.redactedSummary)).not.toContain("Private description");
      expect(JSON.stringify(result.value.redactedSummary)).not.toContain("calendar-secret-token");
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

  test("rejects forged Google API host before sending bearer token", async () => {
    let calls=0;
    const http:GoogleCalendarHttpTransport=async()=>{
      calls++;
      return {status:200,body:JSON.stringify({items:[]})};
    };
    for(const calendarApiBaseUrl of [
      "http://www.googleapis.com/calendar/v3",
      "https://www.googleapis.com.evil.test/calendar/v3",
      "https://www.googleapis.com:444/calendar/v3",
      "https://www.googleapis.com/calendar/v3/freeBusy",
      "https://u:p@www.googleapis.com/calendar/v3",
    ]) {
      expect(await listGoogleCalendarEventsPage(
        {...config,calendarApiBaseUrl},{calendarId:"crew@example.test"},http))
        .toMatchObject({ok:false,code:"GOOGLE_CALENDAR_CONFIGURATION_BLOCKED"});
    }
    expect(calls).toBe(0);
  });

  test("denies incompatible, invalid or oversized sync inputs", async () => {
    let calls=0;
    const http:GoogleCalendarHttpTransport=async()=> {
      calls++;
      return {status:200,body:JSON.stringify({items:[]})};
    };
    for(const request of [
      {calendarId:"crew@example.test",syncToken:"cursor",timeMin:"2026-10-13T00:00:00Z"},
      {calendarId:"crew@example.test",pageToken:"x".repeat(4097)},
      {calendarId:"crew@example.test",timeMin:"not-a-clock"},
      {calendarId:"crew@example.test",timeMin:"2026-10-20T00:00:00Z",timeMax:"2026-10-19T00:00:00Z"},
      {calendarId:"crew@example.test\\n"},
    ]) {
      expect((await listGoogleCalendarEventsPage(config,request,http)).ok).toBe(false);
    }
    expect(calls).toBe(0);
  });

  test("does not mark malformed provider pages as an empty verified calendar", async () => {
    const badBodies=[
      "null","[]","{}",JSON.stringify({items:[{id:"valid"},{oops:"missing-id"}]}),
      JSON.stringify({items:[],nextPageToken:"x",nextSyncToken:"y"}),
      JSON.stringify({items:[],nextPageToken:[]}),
      "x".repeat(512*1024+1),
    ];
    for(const body of badBodies){
      const result=await listGoogleCalendarEventsPage(config,
        {calendarId:"crew@example.test"},async()=>({status:200,body}));
      expect(result).toMatchObject({ok:false,code:"GOOGLE_CALENDAR_INVALID_RESPONSE"});
    }
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
