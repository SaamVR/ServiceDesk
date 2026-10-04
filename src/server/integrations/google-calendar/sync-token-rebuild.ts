export type GoogleCalendarSyncRecoveryAction = "FULL_REBUILD_EXTERNAL_CACHE" | "RETRY_INCREMENTAL_SYNC" | "RECONNECT_REQUIRED";
export type GoogleCalendarSyncRecoveryReason = "SYNC_TOKEN_EXPIRED" | "TRANSIENT_PROVIDER_FAILURE" | "MISSING_CALENDAR";

export interface GoogleCalendarSyncTokenRecoveryInput {
  workspaceId: string;
  crewId: string;
  calendarId?: string;
  syncToken?: string;
  providerFailureCode: string;
  now: string;
}

export interface GoogleCalendarSyncTokenRecoveryPlan {
  action: GoogleCalendarSyncRecoveryAction;
  reason: GoogleCalendarSyncRecoveryReason;
  workspaceId: string;
  crewId: string;
  calendarId?: string;
  discardSyncToken: boolean;
  deleteBusinessVisits: false;
  blocksInstantConfirm: boolean;
  requestedAt: string;
  notes: string[];
}

export function planGoogleCalendarSyncTokenRecovery(input: GoogleCalendarSyncTokenRecoveryInput): GoogleCalendarSyncTokenRecoveryPlan {
  if (!input.calendarId || input.providerFailureCode === "GOOGLE_CALENDAR_MISSING_CALENDAR") {
    return {
      action: "RECONNECT_REQUIRED",
      reason: "MISSING_CALENDAR",
      workspaceId: input.workspaceId,
      crewId: input.crewId,
      calendarId: input.calendarId,
      discardSyncToken: false,
      deleteBusinessVisits: false,
      blocksInstantConfirm: true,
      requestedAt: input.now,
      notes: ["Google Calendar mapping is missing; reconnect or repair configuration before provider-backed availability can be trusted."],
    };
  }

  if (input.providerFailureCode === "GOOGLE_CALENDAR_SYNC_TOKEN_EXPIRED") {
    return {
      action: "FULL_REBUILD_EXTERNAL_CACHE",
      reason: "SYNC_TOKEN_EXPIRED",
      workspaceId: input.workspaceId,
      crewId: input.crewId,
      calendarId: input.calendarId,
      discardSyncToken: true,
      deleteBusinessVisits: false,
      blocksInstantConfirm: true,
      requestedAt: input.now,
      notes: ["Discard Google Calendar sync cursor and rebuild external cache; never delete ServiceDesk visits from provider sync failure."],
    };
  }

  return {
    action: "RETRY_INCREMENTAL_SYNC",
    reason: "TRANSIENT_PROVIDER_FAILURE",
    workspaceId: input.workspaceId,
    crewId: input.crewId,
    calendarId: input.calendarId,
    discardSyncToken: false,
    deleteBusinessVisits: false,
    blocksInstantConfirm: true,
    requestedAt: input.now,
    notes: ["Retry Google Calendar incremental sync with the existing cursor; provider failure must not mutate ServiceDesk visit truth."],
  };
}
