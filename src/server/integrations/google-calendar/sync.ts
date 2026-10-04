import type { Result } from "../../../contracts";
import type { CalendarBusyRange, CalendarSyncState } from "../types";

export interface GoogleCalendarProviderEvent {
  id: string;
  status?: "confirmed" | "cancelled" | string;
  transparency?: "opaque" | "transparent" | string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  summary?: string;
  description?: string;
}

export interface GoogleCalendarEventPage {
  events: GoogleCalendarProviderEvent[];
  nextPageToken?: string;
  nextSyncToken?: string;
}

export interface CalendarEventPageRequest {
  calendarId: string;
  timeMin?: string;
  timeMax?: string;
  pageToken?: string;
  syncToken?: string;
}

export type CalendarEventPageFetcher = (input: CalendarEventPageRequest) => Promise<Result<GoogleCalendarEventPage>>;

export type CalendarSyncMode = "FULL_SYNC" | "INCREMENTAL_SYNC" | "FULL_REBUILD_REQUIRED";

export interface CalendarSyncRunInput {
  state: CalendarSyncState;
  now: string;
  fetchPage: CalendarEventPageFetcher;
  fullSyncRange?: { timeMin: string; timeMax: string };
}

export interface CalendarSyncRunResult {
  mode: CalendarSyncMode;
  nextState: CalendarSyncState;
  busy: CalendarBusyRange[];
  pagesFetched: number;
  canMutateBookingTruth: false;
  notes: string[];
}

function isIsoLike(value: string | undefined): value is string {
  if (!value) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time);
}

export function normalizeGoogleCalendarEventBusy(calendarId: string, event: GoogleCalendarProviderEvent): CalendarBusyRange | null {
  if (event.status === "cancelled") return null;
  if (event.transparency === "transparent") return null;

  const startAt = event.start?.dateTime;
  const endAt = event.end?.dateTime;
  if (!isIsoLike(startAt) || !isIsoLike(endAt)) return null;

  return {
    calendarId,
    startAt,
    endAt,
    source: "EXTERNAL_BUSY",
    freshness: "FRESH",
  };
}

function fullRebuildRequired(input: CalendarSyncRunInput, pagesFetched: number, notes: string[]): Result<CalendarSyncRunResult> {
  return {
    ok: true,
    value: {
      mode: "FULL_REBUILD_REQUIRED",
      nextState: {
        ...input.state,
        syncToken: undefined,
        stale: true,
        lastSyncedAt: input.now,
      },
      busy: [],
      pagesFetched,
      canMutateBookingTruth: false,
      notes,
    },
  };
}

export async function runGoogleCalendarSync(input: CalendarSyncRunInput): Promise<Result<CalendarSyncRunResult>> {
  const fullSync = input.state.stale || !input.state.syncToken;
  const mode: Exclude<CalendarSyncMode, "FULL_REBUILD_REQUIRED"> = fullSync ? "FULL_SYNC" : "INCREMENTAL_SYNC";
  const busy: CalendarBusyRange[] = [];
  let pageToken: string | undefined;
  let nextSyncToken: string | undefined;
  let pagesFetched = 0;

  do {
    const page = await input.fetchPage({
      calendarId: input.state.calendarId,
      timeMin: fullSync ? input.fullSyncRange?.timeMin : undefined,
      timeMax: fullSync ? input.fullSyncRange?.timeMax : undefined,
      syncToken: fullSync ? undefined : input.state.syncToken,
      pageToken,
    });

    pagesFetched += 1;

    if (!page.ok) {
      if (page.code === "GOOGLE_CALENDAR_SYNC_TOKEN_EXPIRED") {
        return fullRebuildRequired(input, pagesFetched, ["Google Calendar sync token expired; perform a full rebuild before trusting external busy state."]);
      }
      return page;
    }

    for (const providerEvent of page.value.events) {
      const normalized = normalizeGoogleCalendarEventBusy(input.state.calendarId, providerEvent);
      if (normalized) busy.push(normalized);
    }

    pageToken = page.value.nextPageToken;
    nextSyncToken = page.value.nextSyncToken ?? nextSyncToken;
  } while (pageToken);

  return {
    ok: true,
    value: {
      mode,
      nextState: {
        ...input.state,
        syncToken: nextSyncToken ?? input.state.syncToken,
        stale: false,
        lastSyncedAt: input.now,
      },
      busy,
      pagesFetched,
      canMutateBookingTruth: false,
      notes: [
        mode === "FULL_SYNC" ? "Initial/full Google Calendar sync completed." : "Incremental Google Calendar sync completed.",
        "Calendar sync output is provider-derived busy state only and cannot mutate booking truth directly.",
      ],
    },
  };
}
