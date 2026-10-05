import { describe, expect, it } from "vitest";
import {
  crewCommandFailureToSyncEvent,
  createCrewSyncState,
  reduceCrewSyncState,
  type CrewPendingOperation,
} from "../../src/features/crew/sync-state";

const operation: CrewPendingOperation = {
  id: "op_1",
  visitId: "visit_1",
  kind: "VISIT_TRANSITION",
  baseVersion: 4,
  idempotencyKey: "idem_1",
  createdAt: "2026-10-05T10:00:00.000Z",
  attempts: 0,
};

describe("V2 crew conflict recovery", () => {
  it("turns stale server outcomes into refresh-required state with no retry loop", () => {
    let state = createCrewSyncState(true);
    state = reduceCrewSyncState(state, { type: "QUEUE_OPERATION", operation });
    state = reduceCrewSyncState(state, crewCommandFailureToSyncEvent(operation.id, {
      code: "VERSION_CONFLICT",
      message: "The job changed.",
      serverVersion: 5,
    }));

    expect(state.status).toBe("VERSION_CONFLICT");
    expect(state.retryAvailable).toBe(false);
    expect(state.issue?.serverVersion).toBe(5);

    const retried = reduceCrewSyncState(state, { type: "RETRY_REQUESTED" });
    expect(retried).toEqual(state);
  });

  it("turns no-longer-valid visit actions into refresh-required state", () => {
    let state = createCrewSyncState(true);
    state = reduceCrewSyncState(state, { type: "QUEUE_OPERATION", operation });
    state = reduceCrewSyncState(state, crewCommandFailureToSyncEvent(operation.id, {
      code: "VISIT_STATE_INVALID",
      message: "The visit already moved on.",
    }));

    expect(state.status).toBe("ACTION_NO_LONGER_VALID");
    expect(state.retryAvailable).toBe(false);
  });

  it("treats a changed crew assignment as an invalid action that requires refresh", () => {
    let state = createCrewSyncState(true);
    state = reduceCrewSyncState(state, { type: "QUEUE_OPERATION", operation });
    state = reduceCrewSyncState(state, crewCommandFailureToSyncEvent(operation.id, {
      code: "CREW_ASSIGNMENT_CHANGED",
      message: "This job moved to another crew.",
    }));

    expect(state.status).toBe("ACTION_NO_LONGER_VALID");
    expect(state.retryAvailable).toBe(false);
  });

  it("allows retry only for explicitly retryable transient failures", () => {
    let state = createCrewSyncState(true);
    state = reduceCrewSyncState(state, { type: "QUEUE_OPERATION", operation });
    state = reduceCrewSyncState(state, crewCommandFailureToSyncEvent(operation.id, {
      code: "NETWORK_ERROR",
      message: "Connection interrupted.",
      retryable: true,
    }));

    expect(state.status).toBe("SYNC_FAILED");
    expect(state.retryAvailable).toBe(true);

    state = reduceCrewSyncState(state, { type: "RETRY_REQUESTED" });
    expect(state.status).toBe("LOCAL_ACTION_PENDING");
  });

  it("does not treat unknown failures as retryable by default", () => {
    let state = createCrewSyncState(true);
    state = reduceCrewSyncState(state, { type: "QUEUE_OPERATION", operation });
    state = reduceCrewSyncState(state, crewCommandFailureToSyncEvent(operation.id, {
      code: "UNKNOWN_FAILURE",
      message: "Unknown failure.",
    }));

    expect(state.status).toBe("SYNC_FAILED");
    expect(state.retryAvailable).toBe(false);
  });
});
