import type { Result } from "../../../contracts";
import type { GoogleCalendarProviderEvent } from "./sync";
import type { GoogleCalendarHttpTransport, GoogleCalendarRestConfig, RedactedGoogleCalendarRequestSummary } from "./rest-client";
import { redactedGoogleCalendarRequestSummary } from "./rest-client";

export interface GoogleCalendarEventsPageRequest {
  calendarId: string;
  timeMin?: string;
  timeMax?: string;
  syncToken?: string;
  pageToken?: string;
}

export interface GoogleCalendarEventsPageResult {
  events: GoogleCalendarProviderEvent[];
  nextPageToken?: string;
  nextSyncToken?: string;
  redactedSummary: RedactedGoogleCalendarRequestSummary;
}

function baseUrl(config: GoogleCalendarRestConfig): string {
  return config.calendarApiBaseUrl.replace(/\/+$/, "");
}

function normalizedFailure(status: number): Result<never> {
  if (status === 401) return { ok: false, code: "GOOGLE_CALENDAR_ACCESS_TOKEN_EXPIRED", message: "Google Calendar access token is expired or invalid." };
  if (status === 403) return { ok: false, code: "GOOGLE_CALENDAR_INSUFFICIENT_SCOPE", message: "Google Calendar authorization lacks the required scope." };
  if (status === 404) return { ok: false, code: "GOOGLE_CALENDAR_NOT_FOUND", message: "Google Calendar event list resource was not found." };
  if (status === 410) return { ok: false, code: "GOOGLE_CALENDAR_SYNC_TOKEN_EXPIRED", message: "Google Calendar sync token expired; full rebuild is required." };
  if (status === 429) return { ok: false, code: "GOOGLE_CALENDAR_RATE_LIMITED", message: "Google Calendar rate limit reached." };
  if (status >= 500) return { ok: false, code: "GOOGLE_CALENDAR_TRANSIENT_FAILURE", message: "Google Calendar returned a transient server failure." };
  return { ok: false, code: "GOOGLE_CALENDAR_PROVIDER_REJECTED", message: "Google Calendar rejected the event list request." };
}

function isProviderEvent(value: unknown): value is GoogleCalendarProviderEvent {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const id = (value as { id?: unknown }).id;
  return typeof id === "string" && id.trim().length > 0;
}

function parseJson(body: string): Result<unknown> {
  if (!body) return { ok: true, value: {} };
  try {
    return { ok: true, value: JSON.parse(body) };
  } catch {
    return { ok: false, code: "GOOGLE_CALENDAR_INVALID_RESPONSE", message: "Google Calendar event list response was malformed JSON." };
  }
}

export async function listGoogleCalendarEventsPage(
  config: GoogleCalendarRestConfig,
  input: GoogleCalendarEventsPageRequest,
  http: GoogleCalendarHttpTransport,
): Promise<Result<GoogleCalendarEventsPageResult>> {
  if (!config.calendarApiBaseUrl || !config.accessToken) {
    return { ok: false, code: "GOOGLE_CALENDAR_CONFIGURATION_BLOCKED", message: "Google Calendar REST sync configuration is incomplete." };
  }
  if (!input.calendarId) {
    return { ok: false, code: "GOOGLE_CALENDAR_MISSING_CALENDAR", message: "Calendar ID is required for event sync." };
  }

  const url = new URL(`${baseUrl(config)}/calendars/${encodeURIComponent(input.calendarId)}/events`);
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("showDeleted", input.syncToken ? "true" : "false");
  if (input.timeMin) url.searchParams.set("timeMin", input.timeMin);
  if (input.timeMax) url.searchParams.set("timeMax", input.timeMax);
  if (input.syncToken) url.searchParams.set("syncToken", input.syncToken);
  if (input.pageToken) url.searchParams.set("pageToken", input.pageToken);

  const controller = new AbortController();
  const timeoutMs = Math.max(250, Math.min(config.timeoutMs ?? 10_000, 30_000));
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const request = {
      url: url.toString(),
      method: "GET" as const,
      headers: {
        authorization: `Bearer ${config.accessToken}`,
        "content-type": "application/json",
      },
      signal: controller.signal,
    };
    const response = await http(request);
    if (response.status < 200 || response.status >= 300) return normalizedFailure(response.status);

    const parsed = parseJson(response.body);
    if (!parsed.ok) return parsed;

    const payload = parsed.value as { items?: unknown[]; nextPageToken?: unknown; nextSyncToken?: unknown };
    const items = Array.isArray(payload.items) ? payload.items.filter(isProviderEvent) : [];
    return {
      ok: true,
      value: {
        events: items,
        nextPageToken: typeof payload.nextPageToken === "string" ? payload.nextPageToken : undefined,
        nextSyncToken: typeof payload.nextSyncToken === "string" ? payload.nextSyncToken : undefined,
        redactedSummary: redactedGoogleCalendarRequestSummary(request),
      },
    };
  } catch (error) {
    if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
      return { ok: false, code: "GOOGLE_CALENDAR_TIMEOUT", message: "Google Calendar event sync request timed out." };
    }
    return { ok: false, code: "GOOGLE_CALENDAR_NETWORK_FAILURE", message: "Google Calendar event sync request failed before a valid response was received." };
  } finally {
    clearTimeout(timeout);
  }
}
