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

export function syncStatusLabel(state: CrewSyncState): string {
  switch (state.status) {
    case "ONLINE_SYNCED": return "Online · synced";
    case "OFFLINE_IDLE": return "Offline · no queued changes";
    case "LOCAL_ACTION_PENDING": return state.online ? "Change pending" : "Change pending · offline";
    case "SYNCING": return "Syncing";
    case "SYNC_FAILED": return "Sync failed";
    case "VERSION_CONFLICT": return "Updated elsewhere · refresh";
    case "ACTION_NO_LONGER_VALID": return "Action no longer valid";
  }
}

export const crewOfflineCapabilityNotice =
  "Keep this page open until pending changes finish syncing. Offline changes are not saved after you close or reload the page.";
