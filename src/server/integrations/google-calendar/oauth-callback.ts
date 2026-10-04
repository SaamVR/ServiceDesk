import type { Result } from "../../../contracts";
import { GOOGLE_CALENDAR_EVENT_SCOPE, GOOGLE_CALENDAR_FREEBUSY_SCOPE, normalizeGoogleCalendarScopes } from "./oauth";

export { GOOGLE_CALENDAR_EVENT_SCOPE, GOOGLE_CALENDAR_FREEBUSY_SCOPE };

export interface GoogleCalendarOAuthExpectedState {
  workspaceId: string;
  crewId: string;
  nonce: string;
}

export interface GoogleCalendarOAuthCallbackInput {
  state?: string;
  code?: string;
  error?: string;
  grantedScopes: string[];
  refreshTokenCaptured: boolean;
}

export interface ValidateGoogleCalendarOAuthCallbackInput {
  expectedState: GoogleCalendarOAuthExpectedState;
  callback: GoogleCalendarOAuthCallbackInput;
}

export interface ValidGoogleCalendarOAuthCallback {
  workspaceId: string;
  crewId: string;
  code: string;
  scopes: string[];
  refreshTokenCaptured: true;
}

function expectedStateToken(state: GoogleCalendarOAuthExpectedState): string {
  return `${state.workspaceId}:${state.crewId}:${state.nonce}`;
}

export function validateGoogleCalendarOAuthCallback(input: ValidateGoogleCalendarOAuthCallbackInput): Result<ValidGoogleCalendarOAuthCallback> {
  if (input.callback.state !== expectedStateToken(input.expectedState)) {
    return { ok: false, code: "GOOGLE_CALENDAR_OAUTH_STATE_MISMATCH", message: "Google Calendar OAuth callback state does not match the expected workspace, crew, and nonce." };
  }

  if (input.callback.error) {
    return { ok: false, code: "GOOGLE_CALENDAR_OAUTH_DENIED", message: "Google Calendar OAuth authorization was denied by the user or provider." };
  }

  if (!input.callback.code?.trim()) {
    return { ok: false, code: "GOOGLE_CALENDAR_OAUTH_MISSING_CODE", message: "Google Calendar OAuth callback is missing an authorization code." };
  }

  const scopes = normalizeGoogleCalendarScopes(input.callback.grantedScopes);
  const hasFreebusy = scopes.includes(GOOGLE_CALENDAR_FREEBUSY_SCOPE) || scopes.includes(GOOGLE_CALENDAR_EVENT_SCOPE);
  const hasEventWrite = scopes.includes(GOOGLE_CALENDAR_EVENT_SCOPE);

  if (!hasFreebusy) {
    return { ok: false, code: "GOOGLE_CALENDAR_OAUTH_MISSING_FREEBUSY_SCOPE", message: "Google Calendar OAuth callback did not grant calendar free/busy read scope." };
  }

  if (!hasEventWrite) {
    return { ok: false, code: "GOOGLE_CALENDAR_OAUTH_MISSING_EVENT_SCOPE", message: "Google Calendar OAuth callback did not grant calendar event write scope." };
  }

  if (!input.callback.refreshTokenCaptured) {
    return { ok: false, code: "GOOGLE_CALENDAR_OAUTH_MISSING_REFRESH_TOKEN", message: "Google Calendar OAuth callback did not capture an offline refresh token." };
  }

  return {
    ok: true,
    value: {
      workspaceId: input.expectedState.workspaceId,
      crewId: input.expectedState.crewId,
      code: input.callback.code,
      scopes,
      refreshTokenCaptured: true,
    },
  };
}
