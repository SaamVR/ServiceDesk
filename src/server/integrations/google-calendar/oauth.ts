import type { Result } from "../../../contracts";

export const GOOGLE_CALENDAR_FREEBUSY_SCOPE = "https://www.googleapis.com/auth/calendar.freebusy";
export const GOOGLE_CALENDAR_EVENT_SCOPE = "https://www.googleapis.com/auth/calendar.events";

export interface GoogleCalendarAuthorizationUrlInput {
  clientId: string;
  redirectUri: string;
  state: string;
  scopes: string[];
}

export interface GoogleCalendarConnectionPolicyInput {
  workspaceId: string;
  crewId: string;
  calendarId?: string;
  scopes: string[];
  encryptedRefreshTokenRef?: string;
  accessTokenExpiresAt?: string;
  now: string;
}

export interface GoogleCalendarConnectionPolicy {
  workspaceId: string;
  crewId: string;
  calendarId?: string;
  status: "CONNECTED" | "DEGRADED" | "REAUTH_REQUIRED" | "NOT_CONFIGURED";
  reason?: "MISSING_CALENDAR" | "MISSING_REFRESH_TOKEN" | "MISSING_FREEBUSY_SCOPE" | "MISSING_EVENT_SCOPE" | "ACCESS_TOKEN_EXPIRED";
  canReadBusy: boolean;
  canCreateEvents: boolean;
}

export interface GoogleCalendarRefreshInput {
  refreshTokenRef: string;
  clientIdRef: string;
  clientSecretRef: string;
  now: string;
  exchange: () => Promise<Result<{ accessTokenRef: string; expiresAt: string; scopes: string[] }>>;
}

export interface GoogleCalendarRefreshSuccess {
  accessTokenRef: string;
  expiresAt: string;
  scopes: string[];
  refreshedAt: string;
}

export function buildGoogleCalendarAuthorizationUrl(input: GoogleCalendarAuthorizationUrlInput): URL {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", input.state);
  url.searchParams.set("scope", Array.from(new Set(input.scopes)).join(" "));
  return url;
}

export function evaluateGoogleCalendarConnection(input: GoogleCalendarConnectionPolicyInput): GoogleCalendarConnectionPolicy {
  if (!input.calendarId) {
    return {
      workspaceId: input.workspaceId,
      crewId: input.crewId,
      status: "NOT_CONFIGURED",
      reason: "MISSING_CALENDAR",
      canReadBusy: false,
      canCreateEvents: false,
    };
  }

  if (!input.encryptedRefreshTokenRef) {
    return {
      workspaceId: input.workspaceId,
      crewId: input.crewId,
      calendarId: input.calendarId,
      status: "REAUTH_REQUIRED",
      reason: "MISSING_REFRESH_TOKEN",
      canReadBusy: false,
      canCreateEvents: false,
    };
  }

  const hasFreeBusyScope = input.scopes.includes(GOOGLE_CALENDAR_FREEBUSY_SCOPE) || input.scopes.includes(GOOGLE_CALENDAR_EVENT_SCOPE);
  const hasEventScope = input.scopes.includes(GOOGLE_CALENDAR_EVENT_SCOPE);

  if (!hasFreeBusyScope) {
    return {
      workspaceId: input.workspaceId,
      crewId: input.crewId,
      calendarId: input.calendarId,
      status: "REAUTH_REQUIRED",
      reason: "MISSING_FREEBUSY_SCOPE",
      canReadBusy: false,
      canCreateEvents: false,
    };
  }

  if (input.accessTokenExpiresAt && new Date(input.accessTokenExpiresAt).getTime() <= new Date(input.now).getTime()) {
    return {
      workspaceId: input.workspaceId,
      crewId: input.crewId,
      calendarId: input.calendarId,
      status: "REAUTH_REQUIRED",
      reason: "ACCESS_TOKEN_EXPIRED",
      canReadBusy: false,
      canCreateEvents: false,
    };
  }

  if (!hasEventScope) {
    return {
      workspaceId: input.workspaceId,
      crewId: input.crewId,
      calendarId: input.calendarId,
      status: "DEGRADED",
      reason: "MISSING_EVENT_SCOPE",
      canReadBusy: true,
      canCreateEvents: false,
    };
  }

  return {
    workspaceId: input.workspaceId,
    crewId: input.crewId,
    calendarId: input.calendarId,
    status: "CONNECTED",
    canReadBusy: true,
    canCreateEvents: true,
  };
}

export async function refreshGoogleCalendarAccessToken(input: GoogleCalendarRefreshInput): Promise<Result<GoogleCalendarRefreshSuccess>> {
  const exchanged = await input.exchange();
  if (!exchanged.ok) {
    if (exchanged.code === "invalid_grant") {
      return {
        ok: false,
        code: "GOOGLE_CALENDAR_RECONNECT_REQUIRED",
        message: "Google Calendar refresh token was revoked or expired; reconnect is required.",
      };
    }
    return {
      ok: false,
      code: "GOOGLE_CALENDAR_REFRESH_FAILED",
      message: exchanged.message,
    };
  }

  return {
    ok: true,
    value: {
      accessTokenRef: exchanged.value.accessTokenRef,
      expiresAt: exchanged.value.expiresAt,
      scopes: exchanged.value.scopes,
      refreshedAt: input.now,
    },
  };
}
