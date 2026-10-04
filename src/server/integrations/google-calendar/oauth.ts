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

export interface GoogleCalendarOAuthConfig {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  now: string;
  timeoutMs?: number;
}

export interface GoogleCalendarOAuthHttpRequest {
  url: string;
  method: "POST";
  headers: Record<string, string>;
  body: string;
  signal: AbortSignal;
}

export interface GoogleCalendarOAuthHttpResponse {
  status: number;
  body: string;
}

export type GoogleCalendarOAuthHttpTransport = (request: GoogleCalendarOAuthHttpRequest) => Promise<GoogleCalendarOAuthHttpResponse>;

export interface GoogleCalendarAuthorizationCodeInput {
  code: string;
}

export interface GoogleCalendarRefreshTokenExchangeInput {
  refreshTokenRef: string;
}

export interface GoogleCalendarTokenExchangeSuccess {
  accessTokenRef: string;
  refreshTokenRef?: string;
  expiresAt: string;
  scopes: string[];
  exchangedAt: string;
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
      status: "DEGRADED",
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

export function normalizeGoogleCalendarScopes(scopes: string | string[] | undefined): string[] {
  if (!scopes) return [];
  const parts = Array.isArray(scopes) ? scopes : scopes.split(/\s+/g);
  return Array.from(new Set(parts.map((scope) => scope.trim()).filter(Boolean))).sort();
}

function expiresAt(now: string, expiresIn: unknown): Result<string> {
  if (typeof expiresIn !== "number" || !Number.isFinite(expiresIn) || expiresIn <= 0) {
    return { ok: false, code: "GOOGLE_CALENDAR_OAUTH_INVALID_RESPONSE", message: "Google Calendar OAuth response is missing a valid expires_in value." };
  }
  return { ok: true, value: new Date(new Date(now).getTime() + expiresIn * 1000).toISOString() };
}

function normalizedOAuthFailure(status: number, body: string): Result<never> {
  let parsed: { error?: unknown; error_description?: unknown } = {};
  try {
    parsed = JSON.parse(body) as { error?: unknown; error_description?: unknown };
  } catch {
    parsed = {};
  }
  const error = typeof parsed.error === "string" ? parsed.error : "";
  if (status === 400 && error === "invalid_grant") {
    return { ok: false, code: "GOOGLE_CALENDAR_RECONNECT_REQUIRED", message: "Google Calendar refresh or authorization grant is invalid; reconnect is required." };
  }
  if (status === 401 || status === 403) {
    return { ok: false, code: "GOOGLE_CALENDAR_OAUTH_CONFIGURATION_BLOCKED", message: "Google Calendar OAuth client authentication failed." };
  }
  if (status === 429) {
    return { ok: false, code: "GOOGLE_CALENDAR_OAUTH_RATE_LIMITED", message: "Google Calendar OAuth rate limit reached." };
  }
  if (status >= 500) {
    return { ok: false, code: "GOOGLE_CALENDAR_OAUTH_TRANSIENT_FAILURE", message: "Google Calendar OAuth endpoint returned a transient failure." };
  }
  return { ok: false, code: "GOOGLE_CALENDAR_OAUTH_REJECTED", message: "Google Calendar OAuth exchange was rejected." };
}

async function callOAuth(config: GoogleCalendarOAuthConfig, body: URLSearchParams, http: GoogleCalendarOAuthHttpTransport): Promise<Result<unknown>> {
  if (!config.tokenUrl || !config.clientId || !config.clientSecret) {
    return { ok: false, code: "GOOGLE_CALENDAR_OAUTH_CONFIGURATION_BLOCKED", message: "Google Calendar OAuth configuration is incomplete." };
  }

  const controller = new AbortController();
  const timeoutMs = Math.max(250, Math.min(config.timeoutMs ?? 10_000, 30_000));
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await http({
      url: config.tokenUrl,
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: controller.signal,
    });
    if (response.status < 200 || response.status >= 300) return normalizedOAuthFailure(response.status, response.body);
    try {
      return { ok: true, value: JSON.parse(response.body) };
    } catch {
      return { ok: false, code: "GOOGLE_CALENDAR_OAUTH_INVALID_RESPONSE", message: "Google Calendar OAuth endpoint returned malformed JSON." };
    }
  } catch (error) {
    if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
      return { ok: false, code: "GOOGLE_CALENDAR_OAUTH_TIMEOUT", message: "Google Calendar OAuth exchange timed out." };
    }
    return { ok: false, code: "GOOGLE_CALENDAR_OAUTH_NETWORK_FAILURE", message: "Google Calendar OAuth exchange failed before a valid response was received." };
  } finally {
    clearTimeout(timeout);
  }
}

function tokenResult(config: GoogleCalendarOAuthConfig, parsed: unknown, refreshTokenRef?: string): Result<GoogleCalendarTokenExchangeSuccess> {
  const token = (parsed as { access_token?: unknown }).access_token;
  if (typeof token !== "string" || !token.trim()) {
    return { ok: false, code: "GOOGLE_CALENDAR_OAUTH_INVALID_RESPONSE", message: "Google Calendar OAuth response is missing an access token." };
  }

  const expires = expiresAt(config.now, (parsed as { expires_in?: unknown }).expires_in);
  if (!expires.ok) return expires;

  const providerRefresh = (parsed as { refresh_token?: unknown }).refresh_token;
  return {
    ok: true,
    value: {
      accessTokenRef: "provider-calendar-token-ref",
      refreshTokenRef: typeof providerRefresh === "string" && providerRefresh.trim() ? "provider-calendar-refresh-ref" : refreshTokenRef,
      expiresAt: expires.value,
      scopes: normalizeGoogleCalendarScopes((parsed as { scope?: unknown }).scope as string | string[] | undefined),
      exchangedAt: config.now,
    },
  };
}

export async function exchangeGoogleCalendarAuthorizationCode(
  config: GoogleCalendarOAuthConfig,
  input: GoogleCalendarAuthorizationCodeInput,
  http: GoogleCalendarOAuthHttpTransport,
): Promise<Result<GoogleCalendarTokenExchangeSuccess>> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: config.redirectUri,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });
  const response = await callOAuth(config, body, http);
  if (!response.ok) return response;
  return tokenResult(config, response.value);
}

export async function exchangeGoogleCalendarRefreshToken(
  config: GoogleCalendarOAuthConfig,
  input: GoogleCalendarRefreshTokenExchangeInput,
  http: GoogleCalendarOAuthHttpTransport,
): Promise<Result<GoogleCalendarTokenExchangeSuccess>> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: input.refreshTokenRef,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });
  const response = await callOAuth(config, body, http);
  if (!response.ok) return response;
  return tokenResult(config, response.value, input.refreshTokenRef);
}
