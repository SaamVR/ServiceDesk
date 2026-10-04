import { describe, expect, test } from "vitest";
import type { VisitDTO } from "../../src/contracts";
import { GOOGLE_CALENDAR_EVENT_SCOPE, GOOGLE_CALENDAR_FREEBUSY_SCOPE } from "../../src/server/integrations/google-calendar/oauth";
import { ConfiguredGoogleCalendarAdapter, type GoogleCalendarHttpTransport } from "../../src/server/integrations/google-calendar/configured-adapter";

const visit: VisitDTO = {
  id: "visit-1",
  workspaceId: "ws-clearnest",
  requestId: "req-1",
  quoteId: "quote-1",
  crewId: "crew-1",
  status: "CONFIRMED",
  startAt: "2026-10-04T09:00:00.000Z",
  serviceMinutes: 120,
  bufferMinutes: 30,
  version: 1,
};

function adapter(overrides: Partial<ConstructorParameters<typeof ConfiguredGoogleCalendarAdapter>[0]> = {}, calls: Array<Parameters<GoogleCalendarHttpTransport>[0]> = []) {
  const http: GoogleCalendarHttpTransport = async (request) => {
    calls.push(request);
    if (request.method === "POST" && request.url.endsWith("/freeBusy")) {
      return { status: 200, body: JSON.stringify({ calendars: { "crew-calendar": { busy: [{ start: "2026-10-04T10:00:00.000Z", end: "2026-10-04T10:30:00.000Z" }] } } }) };
    }
    if (request.method === "DELETE") return { status: 204, body: "" };
    return { status: 200, body: JSON.stringify({ id: "event-1", status: "confirmed" }) };
  };

  return new ConfiguredGoogleCalendarAdapter({
    workspaceId: "ws-clearnest",
    crewId: "crew-1",
    calendarId: "crew-calendar",
    scopes: [GOOGLE_CALENDAR_FREEBUSY_SCOPE, GOOGLE_CALENDAR_EVENT_SCOPE],
    encryptedRefreshTokenRef: "refresh-ref",
    accessToken: "access-token",
    accessTokenExpiresAt: "2026-10-04T10:00:00.000Z",
    now: () => "2026-10-04T09:00:00.000Z",
    calendarApiBaseUrl: "https://www.googleapis.com/calendar/v3",
    http,
    mode: "SANDBOX",
    eventIdsByVisitId: {},
    ...overrides,
  });
}

describe("ConfiguredGoogleCalendarAdapter", () => {
  test("lists busy ranges through the REST client when connection policy is healthy", async () => {
    const calls: Array<Parameters<GoogleCalendarHttpTransport>[0]> = [];
    const result = await adapter({}, calls).listBusy({ from: "2026-10-04T09:00:00.000Z", to: "2026-10-04T12:00:00.000Z" }, "crew-1");

    expect(result).toMatchObject({ ok: true, value: [{ calendarId: "crew-calendar", source: "EXTERNAL_BUSY", freshness: "FRESH" }] });
    expect(calls).toHaveLength(1);
    expect(JSON.parse(calls[0].body ?? "{}")).toMatchObject({ items: [{ id: "crew-calendar" }] });
  });

  test("refreshes an expired access token before provider calls when refresh is available", async () => {
    const calls: Array<Parameters<GoogleCalendarHttpTransport>[0]> = [];
    let refreshCalls = 0;
    const result = await adapter(
      {
        accessTokenExpiresAt: "2026-10-04T08:00:00.000Z",
        refreshAccessToken: async () => {
          refreshCalls += 1;
          return { ok: true, value: { accessToken: "refreshed-token", expiresAt: "2026-10-04T10:00:00.000Z", scopes: [GOOGLE_CALENDAR_FREEBUSY_SCOPE, GOOGLE_CALENDAR_EVENT_SCOPE] } };
        },
      },
      calls,
    ).listBusy({ from: "2026-10-04T09:00:00.000Z", to: "2026-10-04T12:00:00.000Z" }, "crew-1");

    expect(result.ok).toBe(true);
    expect(refreshCalls).toBe(1);
    expect(calls[0].headers.authorization).toBe("Bearer refreshed-token");
  });

  test("blocks provider calls when connection cannot be refreshed", async () => {
    const calls: Array<Parameters<GoogleCalendarHttpTransport>[0]> = [];
    const result = await adapter({ calendarId: undefined }, calls).listBusy({ from: "2026-10-04T09:00:00.000Z", to: "2026-10-04T12:00:00.000Z" }, "crew-1");

    expect(result).toMatchObject({ ok: false, code: "CALENDAR_NOT_CONFIGURED" });
    expect(calls).toHaveLength(0);
  });

  test("creates, patches, and cancels REST events with redacted evidence", async () => {
    const calls: Array<Parameters<GoogleCalendarHttpTransport>[0]> = [];
    const created = await adapter({}, calls).createOrUpdate(visit);
    const patched = await adapter({ eventIdsByVisitId: { "visit-1": "event-1" } }, calls).createOrUpdate(visit);
    const cancelled = await adapter({ eventIdsByVisitId: { "visit-1": "event-1" } }, calls).cancel(visit, { idempotencyKey: "cmd-1", now: "2026-10-04T09:00:00.000Z" });

    expect(created).toMatchObject({ ok: true, value: { providerEventId: "event-1", evidence: { provider: "GOOGLE_CALENDAR", verification: "CONTRACT_TESTED" } } });
    expect(patched).toMatchObject({ ok: true, value: { providerEventId: "event-1" } });
    expect(cancelled).toMatchObject({ ok: true, value: { providerEventId: "event-1" } });
    expect(calls.map((call) => call.method)).toEqual(["POST", "PATCH", "DELETE"]);
    expect(JSON.stringify(created)).not.toContain("access-token");
  });

  test("returns a typed error without provider call when cancelling without a mapped event", async () => {
    const calls: Array<Parameters<GoogleCalendarHttpTransport>[0]> = [];
    const result = await adapter({}, calls).cancel(visit, { idempotencyKey: "cmd-1", now: "2026-10-04T09:00:00.000Z" });

    expect(result).toMatchObject({ ok: false, code: "CALENDAR_EVENT_NOT_FOUND" });
    expect(calls).toHaveLength(0);
  });
});
