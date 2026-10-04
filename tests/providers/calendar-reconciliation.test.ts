import { describe, expect, test } from "vitest";
import { planCalendarReconciliation, summarizeCalendarReconciliation } from "../../src/server/integrations/google-calendar/reconciliation";

describe("Google Calendar reconciliation", () => {
  test("expired sync token requires full rebuild before instant confirmation", () => {
    const plan = planCalendarReconciliation({
      workspaceId: "ws-clearnest",
      crewId: "crew-1",
      calendarId: "cal-1",
      syncToken: "expired",
      stale: true,
      lastSyncedAt: "2026-10-04T09:00:00.000Z",
      now: "2026-10-04T12:00:00.000Z",
    });

    expect(plan).toMatchObject({
      action: "FULL_REBUILD_REQUIRED",
      canInstantConfirm: false,
      blocksAvailability: true,
      reason: "SYNC_TOKEN_EXPIRED",
    });
    expect(plan.canMutateBookingTruth).toBe(false);
  });

  test("fresh sync state allows normal availability use", () => {
    const plan = planCalendarReconciliation({
      workspaceId: "ws-clearnest",
      crewId: "crew-1",
      calendarId: "cal-1",
      syncToken: "sync_123",
      stale: false,
      lastSyncedAt: "2026-10-04T11:55:00.000Z",
      now: "2026-10-04T12:00:00.000Z",
    });

    expect(plan).toMatchObject({
      action: "NOOP",
      canInstantConfirm: true,
      blocksAvailability: false,
      reason: "FRESH",
    });
  });

  test("old but non-expired sync requests incremental catch-up", () => {
    const plan = planCalendarReconciliation({
      workspaceId: "ws-clearnest",
      crewId: "crew-1",
      calendarId: "cal-1",
      syncToken: "sync_123",
      stale: false,
      lastSyncedAt: "2026-10-04T08:30:00.000Z",
      now: "2026-10-04T12:00:00.000Z",
      freshnessThresholdMinutes: 30,
    });

    expect(plan).toMatchObject({
      action: "INCREMENTAL_SYNC_REQUIRED",
      canInstantConfirm: false,
      blocksAvailability: true,
      reason: "STALE_LAST_SYNC",
    });
  });

  test("missing selected calendar blocks provider availability", () => {
    const plan = planCalendarReconciliation({
      workspaceId: "ws-clearnest",
      crewId: "crew-1",
      calendarId: undefined,
      stale: false,
      now: "2026-10-04T12:00:00.000Z",
    });

    expect(plan).toMatchObject({ action: "RECONNECT_REQUIRED", reason: "MISSING_CALENDAR", blocksAvailability: true });
  });

  test("future or invalid last-sync timestamps cannot authorize instant confirmation", () => {
    for (const lastSyncedAt of ["2026-10-04T12:05:00.000Z", "not-a-date"]) {
      const plan = planCalendarReconciliation({
        workspaceId: "ws-clearnest",
        crewId: "crew-1",
        calendarId: "cal-1",
        syncToken: "sync_123",
        stale: false,
        lastSyncedAt,
        now: "2026-10-04T12:00:00.000Z",
      });

      expect(plan).toMatchObject({
        action: "INCREMENTAL_SYNC_REQUIRED",
        reason: "STALE_LAST_SYNC",
        canInstantConfirm: false,
        blocksAvailability: true,
      });
    }
  });

  test("summary is redacted and grouped for operator view", () => {
    const summary = summarizeCalendarReconciliation([
      planCalendarReconciliation({ workspaceId: "ws-1", crewId: "crew-1", calendarId: "cal-1", syncToken: "expired", stale: true, now: "2026-10-04T12:00:00.000Z" }),
      planCalendarReconciliation({ workspaceId: "ws-1", crewId: "crew-2", calendarId: "cal-2", syncToken: "sync", stale: false, lastSyncedAt: "2026-10-04T11:58:00.000Z", now: "2026-10-04T12:00:00.000Z" }),
    ]);

    expect(summary).toMatchObject({ total: 2, blocking: 1, instantConfirmAllowed: 1 });
    expect(summary.actions.FULL_REBUILD_REQUIRED).toBe(1);
  });
});
