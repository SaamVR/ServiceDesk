import { describe, expect, test } from "vitest";
import { FixtureCalendarAdapter, listCalendarBusyWithFreshness } from "../../src/server/integrations/google-calendar/adapter";
import { evaluateGoogleCalendarConnection, GOOGLE_CALENDAR_EVENT_SCOPE, GOOGLE_CALENDAR_FREEBUSY_SCOPE } from "../../src/server/integrations/google-calendar/oauth";

describe("Google Calendar free/busy freshness boundary", () => {
  test("returns external busy blocks and allows instant confirmation only when calendar is fresh and event-capable", async () => {
    const adapter = new FixtureCalendarAdapter([
      {
        calendarId: "crew-1",
        startAt: "2026-10-10T11:00:00.000Z",
        endAt: "2026-10-10T12:00:00.000Z",
        source: "EXTERNAL_BUSY",
        freshness: "FRESH",
      },
    ]);
    const policy = evaluateGoogleCalendarConnection({
      workspaceId: "ws-clearnest",
      crewId: "crew-1",
      calendarId: "crew-1",
      scopes: [GOOGLE_CALENDAR_FREEBUSY_SCOPE, GOOGLE_CALENDAR_EVENT_SCOPE],
      encryptedRefreshTokenRef: "refresh-ref",
      accessTokenExpiresAt: "2026-10-10T10:30:00.000Z",
      now: "2026-10-10T10:00:00.000Z",
    });

    const result = await listCalendarBusyWithFreshness(adapter, policy, { from: "2026-10-10T10:00:00.000Z", to: "2026-10-10T13:00:00.000Z" }, "crew-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.busy).toEqual([
        expect.objectContaining({ source: "EXTERNAL_BUSY", startAt: "2026-10-10T11:00:00.000Z" }),
      ]);
      expect(result.value.availabilityFresh).toBe(true);
      expect(result.value.instantConfirmationAllowed).toBe(true);
      expect(result.value.reason).toBeUndefined();
    }
  });

  test("blocks instant confirmation when token expiry makes Calendar stale", async () => {
    const adapter = new FixtureCalendarAdapter();
    const policy = evaluateGoogleCalendarConnection({
      workspaceId: "ws-clearnest",
      crewId: "crew-1",
      calendarId: "crew-1",
      scopes: [GOOGLE_CALENDAR_FREEBUSY_SCOPE, GOOGLE_CALENDAR_EVENT_SCOPE],
      encryptedRefreshTokenRef: "refresh-ref",
      accessTokenExpiresAt: "2026-10-10T09:59:00.000Z",
      now: "2026-10-10T10:00:00.000Z",
    });

    const result = await listCalendarBusyWithFreshness(adapter, policy, { from: "2026-10-10T10:00:00.000Z", to: "2026-10-10T13:00:00.000Z" }, "crew-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.busy).toEqual([]);
      expect(result.value.availabilityFresh).toBe(false);
      expect(result.value.instantConfirmationAllowed).toBe(false);
      expect(result.value.reason).toBe("CALENDAR_STALE_REQUIRES_REFRESH");
    }
  });

  test("allows free-busy reads but blocks instant confirmation when event scope is missing", async () => {
    const adapter = new FixtureCalendarAdapter([
      {
        calendarId: "crew-1",
        startAt: "2026-10-10T11:00:00.000Z",
        endAt: "2026-10-10T12:00:00.000Z",
        source: "EXTERNAL_BUSY",
        freshness: "FRESH",
      },
    ]);
    const policy = evaluateGoogleCalendarConnection({
      workspaceId: "ws-clearnest",
      crewId: "crew-1",
      calendarId: "crew-1",
      scopes: [GOOGLE_CALENDAR_FREEBUSY_SCOPE],
      encryptedRefreshTokenRef: "refresh-ref",
      accessTokenExpiresAt: "2026-10-10T10:30:00.000Z",
      now: "2026-10-10T10:00:00.000Z",
    });

    const result = await listCalendarBusyWithFreshness(adapter, policy, { from: "2026-10-10T10:00:00.000Z", to: "2026-10-10T13:00:00.000Z" }, "crew-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.busy).toHaveLength(1);
      expect(result.value.availabilityFresh).toBe(true);
      expect(result.value.instantConfirmationAllowed).toBe(false);
      expect(result.value.reason).toBe("CALENDAR_EVENT_WRITE_UNAVAILABLE");
    }
  });
});
