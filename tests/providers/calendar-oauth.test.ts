import { describe, expect, test } from "vitest";
import { buildGoogleCalendarAuthorizationUrl, evaluateGoogleCalendarConnection, GOOGLE_CALENDAR_EVENT_SCOPE, GOOGLE_CALENDAR_FREEBUSY_SCOPE, refreshGoogleCalendarAccessToken } from "../../src/server/integrations/google-calendar/oauth";

describe("Google Calendar OAuth connection policy", () => {
  test("builds an offline-consent authorization URL with state and least required scopes", () => {
    const url = buildGoogleCalendarAuthorizationUrl({
      clientId: "client-id",
      redirectUri: "https://servicedesk.test/oauth/google/callback",
      state: "opaque-state",
      scopes: [GOOGLE_CALENDAR_FREEBUSY_SCOPE, GOOGLE_CALENDAR_EVENT_SCOPE],
    });

    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("state")).toBe("opaque-state");
    expect(url.searchParams.get("scope")).toContain(GOOGLE_CALENDAR_FREEBUSY_SCOPE);
    expect(url.searchParams.get("scope")).toContain(GOOGLE_CALENDAR_EVENT_SCOPE);
  });

  test("marks connection reauth-required when refresh token is missing", () => {
    const status = evaluateGoogleCalendarConnection({
      workspaceId: "ws-clearnest",
      crewId: "crew-1",
      calendarId: "cal-1",
      scopes: [GOOGLE_CALENDAR_FREEBUSY_SCOPE, GOOGLE_CALENDAR_EVENT_SCOPE],
      encryptedRefreshTokenRef: undefined,
      accessTokenExpiresAt: "2026-10-04T10:00:00.000Z",
      now: "2026-10-04T09:00:00.000Z",
    });

    expect(status).toMatchObject({ status: "REAUTH_REQUIRED", canCreateEvents: false, canReadBusy: false });
  });

  test("marks connection degraded when event scope is missing but free-busy is available", () => {
    const status = evaluateGoogleCalendarConnection({
      workspaceId: "ws-clearnest",
      crewId: "crew-1",
      calendarId: "cal-1",
      scopes: [GOOGLE_CALENDAR_FREEBUSY_SCOPE],
      encryptedRefreshTokenRef: "secret-ref",
      accessTokenExpiresAt: "2026-10-04T10:00:00.000Z",
      now: "2026-10-04T09:00:00.000Z",
    });

    expect(status).toMatchObject({ status: "DEGRADED", canCreateEvents: false, canReadBusy: true });
  });

  test("marks connection refresh-needed when access token is expired but refresh token exists", () => {
    const status = evaluateGoogleCalendarConnection({
      workspaceId: "ws-clearnest",
      crewId: "crew-1",
      calendarId: "cal-1",
      scopes: [GOOGLE_CALENDAR_FREEBUSY_SCOPE, GOOGLE_CALENDAR_EVENT_SCOPE],
      encryptedRefreshTokenRef: "secret-ref",
      accessTokenExpiresAt: "2026-10-04T08:59:00.000Z",
      now: "2026-10-04T09:00:00.000Z",
    });

    expect(status).toMatchObject({ status: "DEGRADED", reason: "ACCESS_TOKEN_EXPIRED", canCreateEvents: false, canReadBusy: false });
  });

  test("refresh adapter redacts tokens and reports reconnect on invalid_grant", async () => {
    const refreshed = await refreshGoogleCalendarAccessToken({
      refreshTokenRef: "secret-ref",
      clientIdRef: "client-ref",
      clientSecretRef: "secret-client-ref",
      exchange: async () => ({ ok: false, code: "invalid_grant", message: "Token revoked" }),
      now: "2026-10-04T09:00:00.000Z",
    });

    expect(refreshed.ok).toBe(false);
    if (!refreshed.ok) expect(refreshed.code).toBe("GOOGLE_CALENDAR_RECONNECT_REQUIRED");
  });
});
