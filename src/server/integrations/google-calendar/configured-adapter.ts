import type { CommandMeta, Result, VisitDTO } from "../../../contracts";
import type { CalendarAdapter, CalendarBusyRange, CalendarSyncState, ProviderMode, RedactedProviderEvidence } from "../types";
import { evaluateGoogleCalendarConnection, type GoogleCalendarConnectionPolicyInput } from "./oauth";
import {
  deleteGoogleCalendarEvent,
  freeBusyGoogleCalendar,
  insertGoogleCalendarEvent,
  patchGoogleCalendarEvent,
  type GoogleCalendarHttpTransport,
  type GoogleCalendarRestConfig,
} from "./rest-client";

export type { GoogleCalendarHttpTransport } from "./rest-client";

export interface RefreshedGoogleCalendarAccessToken {
  accessToken: string;
  expiresAt: string;
  scopes: string[];
}

export interface ConfiguredGoogleCalendarAdapterOptions {
  workspaceId: string;
  crewId: string;
  calendarId?: string;
  scopes: string[];
  encryptedRefreshTokenRef?: string;
  accessToken: string;
  accessTokenExpiresAt?: string;
  calendarApiBaseUrl: string;
  timeoutMs?: number;
  http: GoogleCalendarHttpTransport;
  now: () => string;
  mode: ProviderMode;
  eventIdsByVisitId?: Record<string, string | undefined>;
  refreshAccessToken?: () => Promise<Result<RefreshedGoogleCalendarAccessToken>>;
  timeZone?: string;
}

interface ReadyGoogleCalendarConnection {
  calendarId: string;
  rest: GoogleCalendarRestConfig;
  scopes: string[];
}

function safeVisitWindow(visit: VisitDTO): Result<{ endAt: string }> {
  const start = Date.parse(visit.startAt);
  const service = visit.serviceMinutes;
  const buffer = visit.bufferMinutes;
  if (!Number.isFinite(start) || !Number.isSafeInteger(service) ||
      service <= 0 || service > 10080 || !Number.isSafeInteger(buffer) ||
      buffer < 0 || buffer > 1440) {
    return {ok:false,code:"CALENDAR_VISIT_WINDOW_INVALID",
      message:"Saved service time or visit start is invalid."};
  }
  const end = start + (service + buffer) * 60_000;
  if (!Number.isFinite(end) || end <= start ||
      !Number.isFinite(new Date(end).getTime())) {
    return {ok:false,code:"CALENDAR_VISIT_WINDOW_INVALID",
      message:"The saved visit end time cannot be confirmed."};
  }
  return {ok:true,value:{endAt:new Date(end).toISOString()}};
}

function evidence(mode: ProviderMode, capturedAt: string, controlledId: string, notes: string[]): RedactedProviderEvidence {
  return {
    provider: "GOOGLE_CALENDAR",
    mode,
    verification: "CONTRACT_TESTED",
    capturedAt,
    controlledId,
    notes,
  };
}

function blockedCode(reason: string | undefined): string {
  switch (reason) {
    case "MISSING_CALENDAR":
      return "CALENDAR_NOT_CONFIGURED";
    case "MISSING_REFRESH_TOKEN":
      return "CALENDAR_RECONNECT_REQUIRED";
    case "MISSING_FREEBUSY_SCOPE":
      return "CALENDAR_RECONNECT_REQUIRED";
    case "ACCESS_TOKEN_EXPIRED":
      return "CALENDAR_STALE_REQUIRES_REFRESH";
    case "MISSING_EVENT_SCOPE":
      return "CALENDAR_EVENT_WRITE_UNAVAILABLE";
    default:
      return "CALENDAR_NOT_AVAILABLE";
  }
}

export class ConfiguredGoogleCalendarAdapter implements CalendarAdapter {
  constructor(private readonly options: ConfiguredGoogleCalendarAdapterOptions) {}

  private policy(scopes: string[] = this.options.scopes, expiresAt: string | undefined = this.options.accessTokenExpiresAt): GoogleCalendarConnectionPolicyInput {
    return {
      workspaceId: this.options.workspaceId,
      crewId: this.options.crewId,
      calendarId: this.options.calendarId,
      scopes,
      encryptedRefreshTokenRef: this.options.encryptedRefreshTokenRef,
      accessTokenExpiresAt: expiresAt,
      now: this.options.now(),
    };
  }

  private async ready(requireEventWrite: boolean): Promise<Result<ReadyGoogleCalendarConnection>> {
    let accessToken = this.options.accessToken;
    let scopes = this.options.scopes;
    let expiresAt = this.options.accessTokenExpiresAt;
    let policy = evaluateGoogleCalendarConnection(this.policy(scopes, expiresAt));

    if (policy.reason === "ACCESS_TOKEN_EXPIRED" && this.options.refreshAccessToken) {
      const refreshed = await this.options.refreshAccessToken();
      if (!refreshed.ok) return refreshed;
      accessToken = refreshed.value.accessToken;
      scopes = refreshed.value.scopes;
      expiresAt = refreshed.value.expiresAt;
      policy = evaluateGoogleCalendarConnection(this.policy(scopes, expiresAt));
    }

    if (policy.status === "NOT_CONFIGURED" || policy.status === "REAUTH_REQUIRED" || !policy.canReadBusy) {
      return { ok: false, code: blockedCode(policy.reason), message: "Google Calendar connection is not ready for provider calls." };
    }

    if (requireEventWrite && !policy.canCreateEvents) {
      return { ok: false, code: "CALENDAR_EVENT_WRITE_UNAVAILABLE", message: "Google Calendar event write scope is unavailable." };
    }

    if (!policy.calendarId) {
      return { ok: false, code: "CALENDAR_NOT_CONFIGURED", message: "Google Calendar selected calendar is missing." };
    }

    return {
      ok: true,
      value: {
        calendarId: policy.calendarId,
        scopes,
        rest: {
          calendarApiBaseUrl: this.options.calendarApiBaseUrl,
          accessToken,
          timeoutMs: this.options.timeoutMs,
        },
      },
    };
  }

  async createOrUpdate(visit: VisitDTO): Promise<Result<{ providerEventId: string; evidence: RedactedProviderEvidence }>> {
    if (visit.workspaceId !== this.options.workspaceId || visit.crewId !== this.options.crewId) {
      return {ok:false,code:"CALENDAR_VISIT_SCOPE_MISMATCH",
        message:"Visit belongs to a different authorized calendar scope."};
    }
    const window = safeVisitWindow(visit);
    if (!window.ok) return window;
    const ready = await this.ready(true);
    if (!ready.ok) return ready;

    const existingProviderEventId = this.options.eventIdsByVisitId?.[visit.id];
    const event = {
      summary: "ServiceDesk visit",
      startAt: visit.startAt,
      endAt: window.value.endAt,
      timeZone: this.options.timeZone ?? "UTC",
      externalId: visit.id,
    };
    const written = existingProviderEventId
      ? await patchGoogleCalendarEvent(ready.value.rest, ready.value.calendarId, existingProviderEventId, event, this.options.http)
      : await insertGoogleCalendarEvent(ready.value.rest, ready.value.calendarId, event, this.options.http);

    if (!written.ok) return written;
    return {
      ok: true,
      value: {
        providerEventId: written.value.providerEventId,
        evidence: evidence(this.options.mode, this.options.now(), written.value.providerEventId, [
          existingProviderEventId ? "Google Calendar event patch accepted by injected transport." : "Google Calendar event insert accepted by injected transport.",
          "Provider event acceptance is CONTRACT_TESTED until controlled Google Calendar proof is captured.",
        ]),
      },
    };
  }

  async cancel(visit: VisitDTO, _meta: CommandMeta): Promise<Result<{ providerEventId: string; evidence: RedactedProviderEvidence }>> {
    if (visit.workspaceId !== this.options.workspaceId || visit.crewId !== this.options.crewId) {
      return {ok:false,code:"CALENDAR_VISIT_SCOPE_MISMATCH",
        message:"Visit belongs to a different authorized calendar scope."};
    }
    const ready = await this.ready(true);
    if (!ready.ok) return ready;

    const providerEventId = this.options.eventIdsByVisitId?.[visit.id];
    if (!providerEventId) {
      return { ok: false, code: "CALENDAR_EVENT_NOT_FOUND", message: "No mapped Google Calendar event exists for this visit." };
    }

    const deleted = await deleteGoogleCalendarEvent(ready.value.rest, ready.value.calendarId, providerEventId, this.options.http);
    if (!deleted.ok) return deleted;
    return {
      ok: true,
      value: {
        providerEventId,
        evidence: evidence(this.options.mode, this.options.now(), providerEventId, [
          "Google Calendar event delete/cancel accepted by injected transport.",
          "Cancellation proof remains CONTRACT_TESTED until controlled Google Calendar proof is captured.",
        ]),
      },
    };
  }

  async listBusy(range: { from: string; to: string }, crewId: string): Promise<Result<CalendarBusyRange[]>> {
    if (crewId !== this.options.crewId) {
      return { ok: false, code: "CALENDAR_CREW_MISMATCH", message: "Configured Google Calendar adapter cannot query another crew calendar." };
    }

    const start = Date.parse(range.from);
    const end = Date.parse(range.to);
    if (!Number.isFinite(start) || !Number.isFinite(end) ||
        start >= end || end - start > 31 * 24 * 60 * 60 * 1000) {
      return {ok:false,code:"CALENDAR_BUSY_RANGE_INVALID",
        message:"Choose a valid availability range of up to 31 days."};
    }
    const ready = await this.ready(false);
    if (!ready.ok) return ready;
    return freeBusyGoogleCalendar(
      ready.value.rest,
      { calendarIds: [ready.value.calendarId], timeMin: range.from, timeMax: range.to, timeZone: this.options.timeZone },
      this.options.http,
    );
  }

  async recoverSync(state: CalendarSyncState): Promise<Result<CalendarSyncState>> {
    return {
      ok: true,
      value: {
        ...state,
        stale: true,
        lastSyncedAt: this.options.now(),
      },
    };
  }
}
