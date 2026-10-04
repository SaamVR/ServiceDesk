export type CalendarReconciliationAction = "NOOP" | "INCREMENTAL_SYNC_REQUIRED" | "FULL_REBUILD_REQUIRED" | "RECONNECT_REQUIRED";
export type CalendarReconciliationReason = "FRESH" | "STALE_LAST_SYNC" | "SYNC_TOKEN_EXPIRED" | "MISSING_CALENDAR" | "MISSING_SYNC_TOKEN" | "MARKED_STALE";

export interface CalendarReconciliationInput {
  workspaceId: string;
  crewId: string;
  calendarId?: string;
  syncToken?: string;
  stale: boolean;
  lastSyncedAt?: string;
  now: string;
  freshnessThresholdMinutes?: number;
}

export interface CalendarReconciliationPlan {
  workspaceId: string;
  crewId: string;
  calendarId?: string;
  action: CalendarReconciliationAction;
  reason: CalendarReconciliationReason;
  canInstantConfirm: boolean;
  blocksAvailability: boolean;
  canMutateBookingTruth: false;
  notes: string[];
}

export interface CalendarReconciliationSummary {
  total: number;
  blocking: number;
  instantConfirmAllowed: number;
  actions: Partial<Record<CalendarReconciliationAction, number>>;
}

function minutesBetween(left: string, right: string): number {
  return Math.abs(new Date(right).getTime() - new Date(left).getTime()) / 60_000;
}

function plan(input: CalendarReconciliationInput, action: CalendarReconciliationAction, reason: CalendarReconciliationReason, canInstantConfirm: boolean, blocksAvailability: boolean, notes: string[]): CalendarReconciliationPlan {
  return {
    workspaceId: input.workspaceId,
    crewId: input.crewId,
    calendarId: input.calendarId,
    action,
    reason,
    canInstantConfirm,
    blocksAvailability,
    canMutateBookingTruth: false,
    notes,
  };
}

export function planCalendarReconciliation(input: CalendarReconciliationInput): CalendarReconciliationPlan {
  if (!input.calendarId) {
    return plan(input, "RECONNECT_REQUIRED", "MISSING_CALENDAR", false, true, ["No selected crew calendar is available; provider availability cannot be trusted."]);
  }

  if (input.syncToken === "expired") {
    return plan(input, "FULL_REBUILD_REQUIRED", "SYNC_TOKEN_EXPIRED", false, true, ["Google Calendar sync token expired; perform a full calendar rebuild before instant confirmation."]);
  }

  if (input.stale) {
    return plan(input, "FULL_REBUILD_REQUIRED", "MARKED_STALE", false, true, ["Calendar state is marked stale; rebuild external busy state before offering instant confirmation."]);
  }

  if (!input.syncToken) {
    return plan(input, "FULL_REBUILD_REQUIRED", "MISSING_SYNC_TOKEN", false, true, ["Calendar has no sync token; perform an initial full sync."]);
  }

  const threshold = input.freshnessThresholdMinutes ?? 15;
  if (!input.lastSyncedAt || minutesBetween(input.lastSyncedAt, input.now) > threshold) {
    return plan(input, "INCREMENTAL_SYNC_REQUIRED", "STALE_LAST_SYNC", false, true, ["Calendar last-sync timestamp is outside freshness threshold; run incremental sync first."]);
  }

  return plan(input, "NOOP", "FRESH", true, false, ["Calendar sync state is fresh enough for provider-backed availability checks."]);
}

export function summarizeCalendarReconciliation(plans: CalendarReconciliationPlan[]): CalendarReconciliationSummary {
  const actions: Partial<Record<CalendarReconciliationAction, number>> = {};
  for (const item of plans) {
    actions[item.action] = (actions[item.action] ?? 0) + 1;
  }

  return {
    total: plans.length,
    blocking: plans.filter((item) => item.blocksAvailability).length,
    instantConfirmAllowed: plans.filter((item) => item.canInstantConfirm).length,
    actions,
  };
}
