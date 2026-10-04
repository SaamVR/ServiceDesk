import { describe, expect, test } from "vitest";
import { planGoogleCalendarSyncTokenRecovery } from "../../src/server/integrations/google-calendar/sync-token-rebuild";

describe("Google Calendar sync token recovery", () => {
  test("expires sync token into a full rebuild without deleting business visits", () => {
    expect(planGoogleCalendarSyncTokenRecovery({
      workspaceId: "ws-clearnest",
      crewId: "crew-1",
      calendarId: "calendar-1",
      syncToken: "expired-token",
      providerFailureCode: "GOOGLE_CALENDAR_SYNC_TOKEN_EXPIRED",
      now: "2026-10-04T12:00:00.000Z",
    })).toEqual({
      action: "FULL_REBUILD_EXTERNAL_CACHE",
      reason: "SYNC_TOKEN_EXPIRED",
      workspaceId: "ws-clearnest",
      crewId: "crew-1",
      calendarId: "calendar-1",
      discardSyncToken: true,
      deleteBusinessVisits: false,
      blocksInstantConfirm: true,
      requestedAt: "2026-10-04T12:00:00.000Z",
      notes: ["Discard Google Calendar sync cursor and rebuild external cache; never delete ServiceDesk visits from provider sync failure."],
    });
  });

  test("transient provider failures retry incremental sync without discarding cursor", () => {
    expect(planGoogleCalendarSyncTokenRecovery({
      workspaceId: "ws-clearnest",
      crewId: "crew-1",
      calendarId: "calendar-1",
      syncToken: "sync-ok",
      providerFailureCode: "GOOGLE_CALENDAR_TRANSIENT_FAILURE",
      now: "2026-10-04T12:00:00.000Z",
    })).toMatchObject({ action: "RETRY_INCREMENTAL_SYNC", reason: "TRANSIENT_PROVIDER_FAILURE", discardSyncToken: false, deleteBusinessVisits: false });
  });

  test("missing calendar blocks until reconnect/configuration repair", () => {
    expect(planGoogleCalendarSyncTokenRecovery({
      workspaceId: "ws-clearnest",
      crewId: "crew-1",
      providerFailureCode: "GOOGLE_CALENDAR_MISSING_CALENDAR",
      now: "2026-10-04T12:00:00.000Z",
    })).toMatchObject({ action: "RECONNECT_REQUIRED", reason: "MISSING_CALENDAR", blocksInstantConfirm: true, deleteBusinessVisits: false });
  });
});
