export type CrewSyncStatus =
  | "ONLINE_SYNCED"
  | "OFFLINE_IDLE"
  | "LOCAL_ACTION_PENDING"
  | "SYNCING"
  | "SYNC_FAILED"
  | "VERSION_CONFLICT"
  | "ACTION_NO_LONGER_VALID";

export type CrewPendingOperationKind =
  | "VISIT_TRANSITION"
  | "CHECKLIST_UPDATE"
  | "EVIDENCE_REFERENCE"
  | "FIELD_NOTE";

export interface CrewPendingOperation {
  id: string;
  visitId: string;
  kind: CrewPendingOperationKind;
  baseVersion: number;
  idempotencyKey: string;
  createdAt: string;
  attempts: number;
}

export interface CrewSyncIssue {
  operationId: string;
  message: string;
  serverVersion?: number;
}

export interface CrewSyncState {
  status: CrewSyncStatus;
  online: boolean;
  pending: CrewPendingOperation[];
  issue?: CrewSyncIssue;
  retryAvailable: boolean;
  persistence: "SESSION_MEMORY_ONLY";
}

export interface CrewSyncPresentation {
  label: string;
  tone: "success" | "neutral" | "warning" | "danger" | "info";
  guidance?: string;
  retryAvailable: boolean;
  refreshRequired: boolean;
}

export interface CrewCommandFailure {
  code: string;
  message: string;
  retryable?: boolean;
  serverVersion?: number;
}

export type CrewSyncEvent =
  | { type: "NETWORK_CHANGED"; online: boolean }
  | { type: "QUEUE_OPERATION"; operation: CrewPendingOperation }
  | { type: "SYNC_STARTED"; operationId: string }
  | { type: "SYNC_SUCCEEDED"; operationId: string }
  | { type: "SYNC_FAILED"; operationId: string; message: string; retryable: boolean }
  | { type: "VERSION_CONFLICT"; operationId: string; message: string; serverVersion?: number }
  | { type: "ACTION_INVALID"; operationId: string; message: string }
  | { type: "RETRY_REQUESTED" }
  | { type: "DISCARD_OPERATION"; operationId: string };

const staleCodes = new Set([
  "VERSION_CONFLICT",
  "STALE_VERSION",
  "IDEMPOTENCY_CONFLICT",
]);

const invalidActionCodes = new Set([
  "VISIT_STATE_INVALID",
  "VISIT_TERMINAL",
  "INVALID_CREW_TRANSITION",
  "CREW_TRANSITION_NOT_ALLOWED",
  "VISIT_NOT_FOUND",
  "CREW_VISIT_NOT_FOUND",
  "CREW_ASSIGNMENT_CHANGED",
  "FORBIDDEN",
  "CREW_UNAUTHORIZED",
  "UNAUTHORIZED_CREW",
]);

export function crewCommandFailureToSyncEvent(
  operationId: string,
  failure: CrewCommandFailure,
): CrewSyncEvent {
  if (staleCodes.has(failure.code)) {
    return {
      type: "VERSION_CONFLICT",
      operationId,
      message: failure.message,
      serverVersion: failure.serverVersion,
    };
  }

  if (invalidActionCodes.has(failure.code)) {
    return {
      type: "ACTION_INVALID",
      operationId,
      message: failure.message,
    };
  }

  return {
    type: "SYNC_FAILED",
    operationId,
    message: failure.message,
    retryable: failure.retryable === true,
  };
}

export function createCrewSyncState(online = true): CrewSyncState {
  return {
    status: online ? "ONLINE_SYNCED" : "OFFLINE_IDLE",
    online,
    pending: [],
    retryAvailable: false,
    persistence: "SESSION_MEMORY_ONLY",
  };
}

function pendingStatus(online: boolean, pendingCount: number): CrewSyncStatus {
  if (pendingCount > 0) return "LOCAL_ACTION_PENDING";
  return online ? "ONLINE_SYNCED" : "OFFLINE_IDLE";
}

export function reduceCrewSyncState(state: CrewSyncState, event: CrewSyncEvent): CrewSyncState {
  switch (event.type) {
    case "NETWORK_CHANGED":
      return {
        ...state,
        online: event.online,
        status: state.pending.length > 0 ? "LOCAL_ACTION_PENDING" : event.online ? "ONLINE_SYNCED" : "OFFLINE_IDLE",
        retryAvailable: state.pending.length > 0 && event.online,
      };
    case "QUEUE_OPERATION":
      return {
        ...state,
        pending: [...state.pending, event.operation],
        status: "LOCAL_ACTION_PENDING",
        retryAvailable: state.online,
        issue: undefined,
      };
    case "SYNC_STARTED":
      return state.pending.some((operation) => operation.id === event.operationId)
        ? { ...state, status: "SYNCING", retryAvailable: false, issue: undefined }
        : state;
    case "SYNC_SUCCEEDED": {
      const pending = state.pending.filter((operation) => operation.id !== event.operationId);
      return {
        ...state,
        pending,
        status: pendingStatus(state.online, pending.length),
        retryAvailable: pending.length > 0 && state.online,
        issue: undefined,
      };
    }
    case "SYNC_FAILED":
      return {
        ...state,
        status: "SYNC_FAILED",
        retryAvailable: event.retryable && state.online,
        issue: { operationId: event.operationId, message: event.message },
      };
    case "VERSION_CONFLICT":
      return {
        ...state,
        status: "VERSION_CONFLICT",
        retryAvailable: false,
        issue: { operationId: event.operationId, message: event.message, serverVersion: event.serverVersion },
      };
    case "ACTION_INVALID":
      return {
        ...state,
        status: "ACTION_NO_LONGER_VALID",
        retryAvailable: false,
        issue: { operationId: event.operationId, message: event.message },
      };
    case "RETRY_REQUESTED":
      return state.retryAvailable
        ? { ...state, status: "LOCAL_ACTION_PENDING", issue: undefined }
        : state;
    case "DISCARD_OPERATION": {
      const pending = state.pending.filter((operation) => operation.id !== event.operationId);
      return {
        ...state,
        pending,
        status: pendingStatus(state.online, pending.length),
        retryAvailable: pending.length > 0 && state.online,
        issue: undefined,
      };
    }
  }
}

export function buildCrewSyncPresentation(state: CrewSyncState): CrewSyncPresentation {
  switch (state.status) {
    case "ONLINE_SYNCED":
      return { label: "Saved", tone: "success", retryAvailable: false, refreshRequired: false };
    case "OFFLINE_IDLE":
      return {
        label: "Offline",
        tone: "warning",
        guidance: "Reconnect before making changes.",
        retryAvailable: false,
        refreshRequired: false,
      };
    case "LOCAL_ACTION_PENDING":
      return {
        label: state.online ? "Pending" : "Pending · offline",
        tone: "warning",
        guidance: "Keep this screen open until pending changes are saved.",
        retryAvailable: state.retryAvailable,
        refreshRequired: false,
      };
    case "SYNCING":
      return { label: "Saving…", tone: "info", retryAvailable: false, refreshRequired: false };
    case "SYNC_FAILED":
      return {
        label: "Couldn’t save",
        tone: "danger",
        guidance: state.retryAvailable ? "Retry when your connection is stable." : "Refresh before trying again.",
        retryAvailable: state.retryAvailable,
        refreshRequired: !state.retryAvailable,
      };
    case "VERSION_CONFLICT":
      return {
        label: "Job updated",
        tone: "warning",
        guidance: "Refresh this job before making another change.",
        retryAvailable: false,
        refreshRequired: true,
      };
    case "ACTION_NO_LONGER_VALID":
      return {
        label: "Action unavailable",
        tone: "warning",
        guidance: "Refresh this job to see the latest status.",
        retryAvailable: false,
        refreshRequired: true,
      };
  }
}

export function syncStatusLabel(state: CrewSyncState): string {
  return buildCrewSyncPresentation(state).label;
}

export const crewOfflineCapabilityNotice =
  "Changes need a connection. If saving fails, reconnect and refresh before trying again.";
