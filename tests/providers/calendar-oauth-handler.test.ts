import { describe, expect, test, vi } from "vitest";
import { handleGoogleCalendarOAuthCallback } from "../../src/server/api-handlers/provider-google";

describe("Google Calendar OAuth callback handler", () => {
  test("rejects state mismatch before token exchange", async () => {
    const exchange = vi.fn();
    const persist = vi.fn();

    const result = await handleGoogleCalendarOAuthCallback({
      query: { code: "auth-code", state: "wrong-state" },
      expectedState: "expected-state",
      workspaceId: "ws-clearnest",
      crewId: "crew-1",
      exchange,
      persistConnection: persist,
    });

    expect(result).toMatchObject({ statusCode: 403, acknowledged: false, retryable: false });
    expect(exchange).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
  });

  test("exchanges code and persists token references without exposing raw tokens", async () => {
    const persist = vi.fn(async () => "SAVED" as const);

    const result = await handleGoogleCalendarOAuthCallback({
      query: { code: "auth-code", state: "expected-state" },
      expectedState: "expected-state",
      workspaceId: "ws-clearnest",
      crewId: "crew-1",
      exchange: async () => ({
        ok: true,
        value: {
          accessTokenRef: "vault:access-token-ref",
          refreshTokenRef: "vault:refresh-token-ref",
          expiresAt: "2026-10-04T08:00:00.000Z",
          scopes: ["https://www.googleapis.com/auth/calendar.events"],
        },
      }),
      persistConnection: persist,
    });

    expect(result).toMatchObject({ statusCode: 200, acknowledged: true, retryable: false });
    expect(persist).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "ws-clearnest",
        crewId: "crew-1",
        accessTokenRef: "vault:access-token-ref",
        refreshTokenRef: "vault:refresh-token-ref",
      }),
    );
    expect(JSON.stringify(result)).not.toContain("auth-code");
  });

  test("returns reconnect-required response for invalid grant", async () => {
    const result = await handleGoogleCalendarOAuthCallback({
      query: { code: "expired-code", state: "expected-state" },
      expectedState: "expected-state",
      workspaceId: "ws-clearnest",
      crewId: "crew-1",
      exchange: async () => ({ ok: false, code: "invalid_grant", message: "Authorization code expired" }),
      persistConnection: async () => "SAVED",
    });

    expect(result).toMatchObject({ statusCode: 409, acknowledged: false, retryable: false });
  });

  test("returns retryable failure when durable connection persistence fails", async () => {
    const result = await handleGoogleCalendarOAuthCallback({
      query: { code: "auth-code", state: "expected-state" },
      expectedState: "expected-state",
      workspaceId: "ws-clearnest",
      crewId: "crew-1",
      exchange: async () => ({
        ok: true,
        value: {
          accessTokenRef: "vault:access-token-ref",
          refreshTokenRef: "vault:refresh-token-ref",
          expiresAt: "2026-10-04T08:00:00.000Z",
          scopes: ["https://www.googleapis.com/auth/calendar.events"],
        },
      }),
      persistConnection: async () => {
        throw new Error("database unavailable");
      },
    });

    expect(result).toMatchObject({ statusCode: 503, acknowledged: false, retryable: true });
  });
});
