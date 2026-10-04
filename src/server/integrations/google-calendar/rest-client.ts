import type { Result } from "../../../contracts";
import type { CalendarBusyRange } from "../types";

export interface GoogleCalendarRestConfig {
  calendarApiBaseUrl: string;
  accessToken: string;
  timeoutMs?: number;
}

export interface GoogleCalendarHttpRequest {
  url: string;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  headers: Record<string, string>;
  body?: string;
  signal: AbortSignal;
}

export interface GoogleCalendarHttpResponse {
  status: number;
  body: string;
}

export type GoogleCalendarHttpTransport = (request: GoogleCalendarHttpRequest) => Promise<GoogleCalendarHttpResponse>;

export interface GoogleCalendarFreeBusyInput {
  calendarIds: string[];
  timeMin: string;
  timeMax: string;
  timeZone?: string;
}

export interface GoogleCalendarEventInput {
  summary?: string;
  startAt: string;
  endAt: string;
  timeZone?: string;
  externalId?: string;
}

export interface GoogleCalendarEventResult {
  providerEventId: string;
  cancelled?: boolean;
}

export interface RedactedGoogleCalendarRequestSummary {
  method: GoogleCalendarHttpRequest["method"];
  host: string;
  endpoint: string;
  hasBearerAuthorization: boolean;
  bodyKeys: string[];
}

function baseUrl(config: GoogleCalendarRestConfig): string {
  return config.calendarApiBaseUrl.replace(/\/+$/, "");
}

function encodePath(value: string): string {
  return encodeURIComponent(value);
}

function eventBody(input: GoogleCalendarEventInput): Record<string, unknown> {
  const body: Record<string, unknown> = {
    start: { dateTime: input.startAt, timeZone: input.timeZone ?? "UTC" },
    end: { dateTime: input.endAt, timeZone: input.timeZone ?? "UTC" },
  };
  if (input.summary) body.summary = input.summary;
  if (input.externalId) body.extendedProperties = { private: { serviceDeskVisitId: input.externalId } };
  return body;
}

function normalizedFailure(status: number): Result<never> {
  if (status === 401) {
    return { ok: false, code: "GOOGLE_CALENDAR_ACCESS_TOKEN_EXPIRED", message: "Google Calendar access token is expired or invalid." };
  }
  if (status === 403) {
    return { ok: false, code: "GOOGLE_CALENDAR_INSUFFICIENT_SCOPE", message: "Google Calendar authorization lacks the required scope." };
  }
  if (status === 404) {
    return { ok: false, code: "GOOGLE_CALENDAR_NOT_FOUND", message: "Google Calendar resource was not found." };
  }
  if (status === 409) {
    return { ok: false, code: "GOOGLE_CALENDAR_CONFLICT", message: "Google Calendar rejected the write because of a conflict." };
  }
  if (status === 410) {
    return { ok: false, code: "GOOGLE_CALENDAR_SYNC_TOKEN_EXPIRED", message: "Google Calendar sync token expired; full rebuild is required." };
  }
  if (status === 429) {
    return { ok: false, code: "GOOGLE_CALENDAR_RATE_LIMITED", message: "Google Calendar rate limit reached." };
  }
  if (status >= 500) {
    return { ok: false, code: "GOOGLE_CALENDAR_TRANSIENT_FAILURE", message: "Google Calendar returned a transient server failure." };
  }
  return { ok: false, code: "GOOGLE_CALENDAR_PROVIDER_REJECTED", message: "Google Calendar rejected the request." };
}

async function callGoogleCalendar(
  config: GoogleCalendarRestConfig,
  request: Omit<GoogleCalendarHttpRequest, "headers" | "signal">,
  http: GoogleCalendarHttpTransport,
): Promise<Result<GoogleCalendarHttpResponse>> {
  if (!config.calendarApiBaseUrl || !config.accessToken) {
    return { ok: false, code: "GOOGLE_CALENDAR_CONFIGURATION_BLOCKED", message: "Google Calendar REST configuration is incomplete." };
  }

  const controller = new AbortController();
  const timeoutMs = Math.max(250, Math.min(config.timeoutMs ?? 10_000, 30_000));
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await http({
      ...request,
      headers: {
        authorization: `Bearer ${config.accessToken}`,
        "content-type": "application/json",
      },
      signal: controller.signal,
    });

    if (response.status < 200 || response.status >= 300) return normalizedFailure(response.status);
    return { ok: true, value: response };
  } catch (error) {
    if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
      return { ok: false, code: "GOOGLE_CALENDAR_TIMEOUT", message: "Google Calendar provider request timed out." };
    }
    return { ok: false, code: "GOOGLE_CALENDAR_NETWORK_FAILURE", message: "Google Calendar provider request failed before a valid response was received." };
  } finally {
    clearTimeout(timeout);
  }
}

function parseJson(body: string): Result<unknown> {
  if (!body) return { ok: true, value: {} };
  try {
    return { ok: true, value: JSON.parse(body) };
  } catch {
    return { ok: false, code: "GOOGLE_CALENDAR_INVALID_RESPONSE", message: "Google Calendar provider returned malformed JSON." };
  }
}

function providerEventId(parsed: unknown): Result<string> {
  const id = (parsed as { id?: unknown }).id;
  if (typeof id !== "string" || !id.trim()) {
    return { ok: false, code: "GOOGLE_CALENDAR_INVALID_RESPONSE", message: "Google Calendar event response is missing an event ID." };
  }
  return { ok: true, value: id };
}

export function redactedGoogleCalendarRequestSummary(request: GoogleCalendarHttpRequest): RedactedGoogleCalendarRequestSummary {
  const url = new URL(request.url);
  let bodyKeys: string[] = [];
  if (request.body) {
    try {
      const parsed = JSON.parse(request.body) as Record<string, unknown>;
      bodyKeys = Object.keys(parsed).sort();
    } catch {
      bodyKeys = ["unparseable-json-body"];
    }
  }
  return {
    method: request.method,
    host: url.host,
    endpoint: url.pathname.replace(/\/calendars\/[^/]+/g, "/calendars/[redacted-calendar]"),
    hasBearerAuthorization: request.headers.authorization?.startsWith("Bearer ") === true,
    bodyKeys,
  };
}

export async function freeBusyGoogleCalendar(
  config: GoogleCalendarRestConfig,
  input: GoogleCalendarFreeBusyInput,
  http: GoogleCalendarHttpTransport,
): Promise<Result<CalendarBusyRange[]>> {
  if (input.calendarIds.length === 0) {
    return { ok: false, code: "GOOGLE_CALENDAR_MISSING_CALENDAR", message: "At least one calendar ID is required for FreeBusy." };
  }

  const response = await callGoogleCalendar(
    config,
    {
      url: `${baseUrl(config)}/freeBusy`,
      method: "POST",
      body: JSON.stringify({
        timeMin: input.timeMin,
        timeMax: input.timeMax,
        timeZone: input.timeZone,
        items: input.calendarIds.map((id) => ({ id })),
      }),
    },
    http,
  );
  if (!response.ok) return response;

  const parsed = parseJson(response.value.body);
  if (!parsed.ok) return parsed;

  const calendars = (parsed.value as { calendars?: Record<string, { busy?: Array<{ start?: unknown; end?: unknown }> }> }).calendars;
  if (!calendars || typeof calendars !== "object") {
    return { ok: false, code: "GOOGLE_CALENDAR_INVALID_RESPONSE", message: "Google Calendar FreeBusy response is missing calendars." };
  }

  const busy: CalendarBusyRange[] = [];
  for (const [calendarId, calendar] of Object.entries(calendars)) {
    const blocks = Array.isArray(calendar.busy) ? calendar.busy : [];
    for (const block of blocks) {
      if (typeof block.start !== "string" || typeof block.end !== "string") continue;
      busy.push({ calendarId, startAt: block.start, endAt: block.end, source: "EXTERNAL_BUSY", freshness: "FRESH" });
    }
  }
  return { ok: true, value: busy };
}

export async function insertGoogleCalendarEvent(
  config: GoogleCalendarRestConfig,
  calendarId: string,
  event: GoogleCalendarEventInput,
  http: GoogleCalendarHttpTransport,
): Promise<Result<GoogleCalendarEventResult>> {
  const response = await callGoogleCalendar(config, { url: `${baseUrl(config)}/calendars/${encodePath(calendarId)}/events`, method: "POST", body: JSON.stringify(eventBody(event)) }, http);
  if (!response.ok) return response;
  const parsed = parseJson(response.value.body);
  if (!parsed.ok) return parsed;
  const id = providerEventId(parsed.value);
  if (!id.ok) return id;
  return { ok: true, value: { providerEventId: id.value } };
}

export async function patchGoogleCalendarEvent(
  config: GoogleCalendarRestConfig,
  calendarId: string,
  eventId: string,
  event: GoogleCalendarEventInput,
  http: GoogleCalendarHttpTransport,
): Promise<Result<GoogleCalendarEventResult>> {
  const response = await callGoogleCalendar(config, { url: `${baseUrl(config)}/calendars/${encodePath(calendarId)}/events/${encodePath(eventId)}`, method: "PATCH", body: JSON.stringify(eventBody(event)) }, http);
  if (!response.ok) return response;
  const parsed = parseJson(response.value.body);
  if (!parsed.ok) return parsed;
  const id = providerEventId(parsed.value);
  if (!id.ok) return id;
  return { ok: true, value: { providerEventId: id.value, cancelled: (parsed.value as { status?: unknown }).status === "cancelled" } };
}

export async function getGoogleCalendarEvent(
  config: GoogleCalendarRestConfig,
  calendarId: string,
  eventId: string,
  http: GoogleCalendarHttpTransport,
): Promise<Result<GoogleCalendarEventResult>> {
  const response = await callGoogleCalendar(config, { url: `${baseUrl(config)}/calendars/${encodePath(calendarId)}/events/${encodePath(eventId)}`, method: "GET" }, http);
  if (!response.ok) return response;
  const parsed = parseJson(response.value.body);
  if (!parsed.ok) return parsed;
  const id = providerEventId(parsed.value);
  if (!id.ok) return id;
  return { ok: true, value: { providerEventId: id.value, cancelled: (parsed.value as { status?: unknown }).status === "cancelled" } };
}

export async function deleteGoogleCalendarEvent(
  config: GoogleCalendarRestConfig,
  calendarId: string,
  eventId: string,
  http: GoogleCalendarHttpTransport,
): Promise<Result<GoogleCalendarEventResult>> {
  const response = await callGoogleCalendar(config, { url: `${baseUrl(config)}/calendars/${encodePath(calendarId)}/events/${encodePath(eventId)}`, method: "DELETE" }, http);
  if (!response.ok) return response;
  return { ok: true, value: { providerEventId: eventId } };
}
