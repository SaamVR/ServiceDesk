import { describe, expect, test } from "vitest";
import {
  GOOGLE_CALENDAR_EVENT_SCOPE,
  GOOGLE_CALENDAR_FREEBUSY_SCOPE,
  validateGoogleCalendarOAuthCallback,
} from "../../src/server/integrations/google-calendar/oauth-callback";

const expectedState = {
  workspaceId: "ws-clearnest",
  crewId: "crew-1",
  nonce: "nonce-123",
};

describe("Google Calendar OAuth callback validation", () => {
  test("accepts valid callback with required scopes and refresh token", () => {
    const result = validateGoogleCalendarOAuthCallback({
      expectedState,
      callback: {
        state: "ws-clearnest:crew-1:nonce-123",
        code: "auth-code",
        grantedScopes: [GOOGLE_CALENDAR_FREEBUSY_SCOPE, GOOGLE_CALENDAR_EVENT_SCOPE],
        refreshTokenCaptured: true,
      },
    });

    expect(result).toEqual({
      ok: true,
      value: {
        workspaceId: "ws-clearnest",
        crewId: "crew-1",
        code: "auth-code",
        scopes: [GOOGLE_CALENDAR_EVENT_SCOPE, GOOGLE_CALENDAR_FREEBUSY_SCOPE],
        refreshTokenCaptured: true,
      },
    });
  });

  test("rejects wrong workspace, wrong crew, denied auth, and missing code", () => {
    expect(validateGoogleCalendarOAuthCallback({ expectedState, callback: { state: "ws-other:crew-1:nonce-123", code: "code", grantedScopes: [], refreshTokenCaptured: true } })).toMatchObject({ ok: false, code: "GOOGLE_CALENDAR_OAUTH_STATE_MISMATCH" });
    expect(validateGoogleCalendarOAuthCallback({ expectedState, callback: { state: "ws-clearnest:crew-2:nonce-123", code: "code", grantedScopes: [], refreshTokenCaptured: true } })).toMatchObject({ ok: false, code: "GOOGLE_CALENDAR_OAUTH_STATE_MISMATCH" });
    expect(validateGoogleCalendarOAuthCallback({ expectedState, callback: { state: "ws-clearnest:crew-1:nonce-123", error: "access_denied", grantedScopes: [], refreshTokenCaptured: false } })).toMatchObject({ ok: false, code: "GOOGLE_CALENDAR_OAUTH_DENIED" });
    expect(validateGoogleCalendarOAuthCallback({ expectedState, callback: { state: "ws-clearnest:crew-1:nonce-123", grantedScopes: [], refreshTokenCaptured: true } })).toMatchObject({ ok: false, code: "GOOGLE_CALENDAR_OAUTH_MISSING_CODE" });
  });

  test("requires freebusy scope, event scope, and offline refresh token", () => {
    expect(validateGoogleCalendarOAuthCallback({ expectedState, callback: { state: "ws-clearnest:crew-1:nonce-123", code: "code", grantedScopes: [], refreshTokenCaptured: true } })).toMatchObject({ ok: false, code: "GOOGLE_CALENDAR_OAUTH_MISSING_FREEBUSY_SCOPE" });
    expect(validateGoogleCalendarOAuthCallback({ expectedState, callback: { state: "ws-clearnest:crew-1:nonce-123", code: "code", grantedScopes: [GOOGLE_CALENDAR_FREEBUSY_SCOPE], refreshTokenCaptured: true } })).toMatchObject({ ok: false, code: "GOOGLE_CALENDAR_OAUTH_MISSING_EVENT_SCOPE" });
    expect(validateGoogleCalendarOAuthCallback({ expectedState, callback: { state: "ws-clearnest:crew-1:nonce-123", code: "code", grantedScopes: [GOOGLE_CALENDAR_FREEBUSY_SCOPE, GOOGLE_CALENDAR_EVENT_SCOPE], refreshTokenCaptured: false } })).toMatchObject({ ok: false, code: "GOOGLE_CALENDAR_OAUTH_MISSING_REFRESH_TOKEN" });
  });
});
