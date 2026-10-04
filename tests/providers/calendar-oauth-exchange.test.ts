import { describe, expect, test } from "vitest";
import {
  exchangeGoogleCalendarAuthorizationCode,
  exchangeGoogleCalendarRefreshToken,
  normalizeGoogleCalendarScopes,
  type GoogleCalendarOAuthHttpTransport,
} from "../../src/server/integrations/google-calendar/oauth";

const config = {
  tokenUrl: "https://oauth2.googleapis.com/token",
  clientId: "client-id",
  clientSecret: "client-secret-value",
  redirectUri: "https://servicedesk.test/oauth/google/callback",
  now: "2026-10-04T09:00:00.000Z",
  timeoutMs: 1000,
};

function transport(status: number, body: unknown, capture?: (input: Parameters<GoogleCalendarOAuthHttpTransport>[0]) => void): GoogleCalendarOAuthHttpTransport {
  return async (input) => {
    capture?.(input);
    return { status, body: typeof body === "string" ? body : JSON.stringify(body) };
  };
}

describe("Google Calendar OAuth exchange transport", () => {
  test("exchanges authorization code with redirect URI and normalized scopes", async () => {
    let request: Parameters<GoogleCalendarOAuthHttpTransport>[0] | undefined;
    const result = await exchangeGoogleCalendarAuthorizationCode(
      config,
      { code: "auth-code" },
      transport(200, { access_token: "access-token", refresh_token: "refresh-token", expires_in: 3600, scope: "scope-a scope-b scope-a" }, (input) => {
        request = input;
      }),
    );

    expect(result.ok).toBe(true);
    expect(request?.url).toBe("https://oauth2.googleapis.com/token");
    expect(request?.method).toBe("POST");
    expect(request?.headers["content-type"]).toBe("application/x-www-form-urlencoded");
    const body = new URLSearchParams(request?.body ?? "");
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code")).toBe("auth-code");
    expect(body.get("redirect_uri")).toBe(config.redirectUri);
    if (result.ok) {
      expect(result.value).toMatchObject({
        accessTokenRef: "provider-calendar-token-ref",
        refreshTokenRef: "provider-calendar-refresh-ref",
        scopes: ["scope-a", "scope-b"],
        expiresAt: "2026-10-04T10:00:00.000Z",
        exchangedAt: "2026-10-04T09:00:00.000Z",
      });
    }
    expect(JSON.stringify(result)).not.toContain("access-token");
    expect(JSON.stringify(result)).not.toContain("refresh-token");
    expect(JSON.stringify(result)).not.toContain("client-secret-value");
  });

  test("refreshes an access token without requiring a new refresh token", async () => {
    const result = await exchangeGoogleCalendarRefreshToken(
      config,
      { refreshTokenRef: "encrypted-refresh-ref" },
      transport(200, { access_token: "new-access-token", expires_in: 1800, scope: ["scope-b", "scope-a", "scope-a"] }),
    );

    expect(result).toMatchObject({
      ok: true,
      value: {
        accessTokenRef: "provider-calendar-token-ref",
        refreshTokenRef: "encrypted-refresh-ref",
        expiresAt: "2026-10-04T09:30:00.000Z",
        scopes: ["scope-a", "scope-b"],
      },
    });
    expect(JSON.stringify(result)).not.toContain("new-access-token");
  });

  test("normalizes invalid grant, malformed responses, rate limits, and timeouts", async () => {
    const invalidGrant = await exchangeGoogleCalendarRefreshToken(config, { refreshTokenRef: "encrypted-refresh-ref" }, transport(400, { error: "invalid_grant", error_description: "revoked" }));
    const malformed = await exchangeGoogleCalendarAuthorizationCode(config, { code: "auth-code" }, transport(200, { expires_in: 3600 }));
    const rateLimited = await exchangeGoogleCalendarAuthorizationCode(config, { code: "auth-code" }, transport(429, { error: "rate_limit_exceeded" }));
    const timeout = await exchangeGoogleCalendarAuthorizationCode(config, { code: "auth-code" }, async () => {
      const error = new Error("timeout");
      error.name = "AbortError";
      throw error;
    });

    expect(invalidGrant).toMatchObject({ ok: false, code: "GOOGLE_CALENDAR_RECONNECT_REQUIRED" });
    expect(malformed).toMatchObject({ ok: false, code: "GOOGLE_CALENDAR_OAUTH_INVALID_RESPONSE" });
    expect(rateLimited).toMatchObject({ ok: false, code: "GOOGLE_CALENDAR_OAUTH_RATE_LIMITED" });
    expect(timeout).toMatchObject({ ok: false, code: "GOOGLE_CALENDAR_OAUTH_TIMEOUT" });
  });

  test("normalizes scope input deterministically", () => {
    expect(normalizeGoogleCalendarScopes("scope-b scope-a scope-b")).toEqual(["scope-a", "scope-b"]);
    expect(normalizeGoogleCalendarScopes(["scope-b", "scope-a", "scope-b"])).toEqual(["scope-a", "scope-b"]);
    expect(normalizeGoogleCalendarScopes(undefined)).toEqual([]);
  });
});
