import { describe, expect, it } from "vitest";
import type { RequestDTO, VisitDTO, VisitEvidenceDTO } from "../../src/contracts";
import {
  approveDispatchRecommendation,
  buildDispatchRecommendations,
  type DispatchSnapshot,
} from "../../src/features/dispatch/recommendations";
import { buildFieldOperationalExceptions } from "../../src/features/dispatch/operational-exceptions";
import {
  buildCrewEvidenceGate,
  buildCrewJobDetailView,
} from "../../src/features/crew/v2-field-models";
import {
  createCrewSyncState,
  reduceCrewSyncState,
  type CrewPendingOperation,
} from "../../src/features/crew/sync-state";
import { createCrewFieldServerActionFactory } from "../../src/features/crew/field-server-boundary";

const request: RequestDTO = {
  id: "req_1",
  workspaceId: "ws_1",
  customerId: "cust_1",
  propertyId: "prop_1",
  serviceCode: "MOVE_OUT",
  status: "BOOKED",
  version: 4,
  createdAt: "2026-10-05T06:00:00.000Z",
  updatedAt: "2026-10-05T06:00:00.000Z",
};

const targetVisit: VisitDTO = {
  id: "visit_target",
  workspaceId: "ws_1",
  requestId: "req_1",
  quoteId: "quote_1",
  status: "CONFIRMED",
  startAt: "2026-10-05T14:00:00.000Z",
  serviceMinutes: 120,
  bufferMinutes: 30,
  version: 7,
};

const operation: CrewPendingOperation = {
  id: "op_1",
  visitId: targetVisit.id,
  kind: "VISIT_TRANSITION",
  baseVersion: 7,
  idempotencyKey: "idem_1",
  createdAt: "2026-10-05T13:55:00.000Z",
  attempts: 0,
};

function dispatchSnapshot(): DispatchSnapshot {
  return {
    visits: [
      {
        ...targetVisit,
        serviceCode: "MOVE_OUT",
      },
      {
        id: "visit_busy_a",
        workspaceId: "ws_1",
        requestId: "req_busy_a",
        quoteId: "quote_busy_a",
        crewId: "crew_a",
        status: "ASSIGNED",
        startAt: "2026-10-05T13:30:00.000Z",
        serviceMinutes: 120,
        bufferMinutes: 30,
        version: 2,
        serviceCode: "MOVE_OUT",
      },
      {
        id: "visit_workload_b",
        workspaceId: "ws_1",
        requestId: "req_busy_b",
        quoteId: "quote_busy_b",
        crewId: "crew_b",
        status: "ASSIGNED",
        startAt: "2026-10-05T09:00:00.000Z",
        serviceMinutes: 60,
        bufferMinutes: 15,
        version: 1,
        serviceCode: "MOVE_OUT",
      },
      {
        id: "visit_workload_c",
        workspaceId: "ws_1",
        requestId: "req_busy_c",
        quoteId: "quote_busy_c",
        crewId: "crew_c",
        status: "ASSIGNED",
        startAt: "2026-10-05T08:00:00.000Z",
        serviceMinutes: 180,
        bufferMinutes: 30,
        version: 1,
        serviceCode: "MOVE_OUT",
      },
    ],
    crews: [
      {
        id: "crew_a",
        workspaceId: "ws_1",
        active: true,
        availableFrom: "2026-10-05T08:00:00.000Z",
        availableTo: "2026-10-05T18:00:00.000Z",
        serviceCodes: ["MOVE_OUT"],
      },
      {
        id: "crew_b",
        workspaceId: "ws_1",
        active: true,
        availableFrom: "2026-10-05T08:00:00.000Z",
        availableTo: "2026-10-05T18:00:00.000Z",
        serviceCodes: ["MOVE_OUT"],
      },
      {
        id: "crew_c",
        workspaceId: "ws_1",
        active: true,
        availableFrom: "2026-10-05T08:00:00.000Z",
        availableTo: "2026-10-05T18:00:00.000Z",
        serviceCodes: ["MOVE_OUT"],
      },
    ],
    attentionItems: [
      {
        id: "attn_1",
        workspaceId: "ws_1",
        type: "FIELD_INCIDENT",
        severity: "WARNING",
        status: "OPEN",
        resourceType: "visit",
        resourceId: targetVisit.id,
        summary: "Field issue requires dispatcher review.",
      },
    ],
  };
}

describe("V2 dispatch recommendations", () => {
  it("is deterministic and does not mutate the authoritative snapshot", () => {
    const snapshot = dispatchSnapshot();
    const before = JSON.stringify(snapshot);
    const first = buildDispatchRecommendations(snapshot);
    const second = buildDispatchRecommendations(snapshot);

    expect(first).toEqual(second);
    expect(JSON.stringify(snapshot)).toBe(before);
    expect(first).toHaveLength(1);
    expect(first[0]?.humanApprovalRequired).toBe(true);
  });

  it("rejects schedule overlap and ranks lower eligible workload first", () => {
    const [recommendation] = buildDispatchRecommendations(dispatchSnapshot());
    expect(recommendation).toBeDefined();

    const overlap = recommendation!.candidates.find((candidate) => candidate.candidateCrewId === "crew_a");
    expect(overlap?.eligible).toBe(false);
    expect(overlap?.conflicts).toContain("SCHEDULE_OVERLAP");

    const eligible = recommendation!.candidates.filter((candidate) => candidate.eligible);
    expect(eligible.map((candidate) => candidate.candidateCrewId)).toEqual(["crew_b", "crew_c"]);
    expect(eligible[0]!.currentWorkloadMinutes).toBeLessThan(eligible[1]!.currentWorkloadMinutes);
    expect(eligible[0]!.routeEfficiency).toBe("NOT_SCORED_NO_GEOGRAPHY");
  });

  it("requires dispatcher/owner approval and produces a command-ready human approval intent", () => {
    const [recommendation] = buildDispatchRecommendations(dispatchSnapshot());
    const crewCandidate = recommendation!.candidates.find((candidate) => candidate.candidateCrewId === "crew_b")!;

    expect(approveDispatchRecommendation({
      recommendation: recommendation!,
      candidateCrewId: crewCandidate.candidateCrewId,
      actorRole: "CREW",
    })).toMatchObject({ ok: false, code: "DISPATCH_APPROVAL_FORBIDDEN" });

    expect(approveDispatchRecommendation({
      recommendation: recommendation!,
      candidateCrewId: crewCandidate.candidateCrewId,
      actorRole: "DISPATCHER",
    })).toEqual({
      ok: true,
      value: {
        status: "APPROVAL_READY_FOR_COMMAND",
        visitId: targetVisit.id,
        candidateCrewId: "crew_b",
        expectedVersion: targetVisit.version,
        approvedByRole: "DISPATCHER",
        humanApprovalRequired: true,
        mutationReady: true,
      },
    });
  });
});

describe("V2 crew sync model", () => {
  it("distinguishes pending, syncing, retryable failure, stale version, and invalid action", () => {
    let state = createCrewSyncState(true);
    expect(state.status).toBe("ONLINE_SYNCED");
    expect(state.persistence).toBe("SESSION_MEMORY_ONLY");

    state = reduceCrewSyncState(state, { type: "QUEUE_OPERATION", operation });
    expect(state.status).toBe("LOCAL_ACTION_PENDING");

    state = reduceCrewSyncState(state, { type: "SYNC_STARTED", operationId: operation.id });
    expect(state.status).toBe("SYNCING");

    state = reduceCrewSyncState(state, {
      type: "SYNC_FAILED",
      operationId: operation.id,
      message: "network unavailable",
      retryable: true,
    });
    expect(state.status).toBe("SYNC_FAILED");
    expect(state.retryAvailable).toBe(true);

    state = reduceCrewSyncState(state, { type: "RETRY_REQUESTED" });
    expect(state.status).toBe("LOCAL_ACTION_PENDING");

    state = reduceCrewSyncState(state, {
      type: "VERSION_CONFLICT",
      operationId: operation.id,
      message: "server is newer",
      serverVersion: 8,
    });
    expect(state.status).toBe("VERSION_CONFLICT");
    expect(state.retryAvailable).toBe(false);
    expect(state.issue?.serverVersion).toBe(8);

    state = reduceCrewSyncState(state, {
      type: "ACTION_INVALID",
      operationId: operation.id,
      message: "assignment changed",
    });
    expect(state.status).toBe("ACTION_NO_LONGER_VALID");
  });

  it("never silently discards pending work on reconnect", () => {
    let state = createCrewSyncState(false);
    state = reduceCrewSyncState(state, { type: "QUEUE_OPERATION", operation });
    state = reduceCrewSyncState(state, { type: "NETWORK_CHANGED", online: true });

    expect(state.pending).toEqual([operation]);
    expect(state.status).toBe("LOCAL_ACTION_PENDING");
    expect(state.retryAvailable).toBe(true);
  });
});

describe("V2 crew authorization and evidence handoff", () => {
  const beforeEvidence: VisitEvidenceDTO = {
    id: "ev_before",
    workspaceId: "ws_1",
    visitId: targetVisit.id,
    kind: "BEFORE_PHOTO",
    mediaReference: { storageProvider: "supabase", objectRef: "private/before.jpg", mimeType: "image/jpeg" },
    capturedAt: "2026-10-05T14:05:00.000Z",
    submittedByUserId: "crew_user",
    createdAt: "2026-10-05T14:05:00.000Z",
  };
  const afterEvidence: VisitEvidenceDTO = {
    ...beforeEvidence,
    id: "ev_after",
    kind: "AFTER_PHOTO",
    mediaReference: { storageProvider: "supabase", objectRef: "private/after.jpg", mimeType: "image/jpeg" },
    capturedAt: "2026-10-05T15:45:00.000Z",
    createdAt: "2026-10-05T15:45:00.000Z",
  };
  const inProgressVisit: VisitDTO = { ...targetVisit, crewId: "crew_b", status: "IN_PROGRESS" };

  it("enforces the same before/after review evidence gate as Core", () => {
    expect(buildCrewEvidenceGate(inProgressVisit, [beforeEvidence])).toMatchObject({
      beforeEvidencePresent: true,
      afterEvidencePresent: false,
      requiredEvidenceComplete: false,
      canSubmitReview: false,
      crewCanComplete: false,
    });

    expect(buildCrewEvidenceGate(inProgressVisit, [beforeEvidence, afterEvidence])).toMatchObject({
      requiredEvidenceComplete: true,
      canSubmitReview: true,
      crewCanComplete: false,
    });
  });

  it("redacts customer/property details outside authorized crew scope", () => {
    const view = buildCrewJobDetailView({
      request,
      visit: inProgressVisit,
      context: {
        authorized: false,
        locationLabel: "Private street address",
        customerLabel: "Private customer",
        accessNotes: "Lockbox 1234",
        serviceNotes: "Private service note",
        highPriorityNotes: ["Private note"],
      },
      sync: createCrewSyncState(true),
      evidence: [beforeEvidence],
      checklist: [],
      uploadTransportAvailable: false,
    });

    expect(view.locationLabel).toBe("Address hidden");
    expect(view.customerLabel).toBeUndefined();
    expect(view.accessNotes).toBeUndefined();
    expect(view.serviceNotes).toBeUndefined();
    expect(view.highPriorityNotes).toEqual([]);
    expect(view.uploadState).toContain("isn’t available");
  });

  it("routes evidence/checklist writes through accepted server commands with visit version metadata", async () => {
    const evidenceCalls: unknown[][] = [];
    const checklistCalls: unknown[][] = [];
    const actions = createCrewFieldServerActionFactory({
      async addVisitEvidence(...args) {
        evidenceCalls.push(args);
        return { ok: true, value: beforeEvidence };
      },
      async setVisitChecklistItem(...args) {
        checklistCalls.push(args);
        return {
          ok: true,
          value: {
            id: "item_1",
            workspaceId: "ws_1",
            visitId: inProgressVisit.id,
            itemKey: "kitchen",
            completed: true,
            updatedByUserId: "crew_user",
            updatedAt: "2026-10-05T15:00:00.000Z",
            version: 2,
          },
        };
      },
    });

    const ctx = { workspaceId: "ws_1", role: "CREW", userId: "crew_user" } as const;
    await actions.addEvidence({
      ctx,
      visit: inProgressVisit,
      evidence: {
        kind: "BEFORE_PHOTO",
        mediaReference: beforeEvidence.mediaReference,
        capturedAt: beforeEvidence.capturedAt,
      },
      idempotencyKey: "evidence_1",
      now: "2026-10-05T15:00:00.000Z",
    });
    await actions.setChecklistItem({
      ctx,
      visit: inProgressVisit,
      item: { itemKey: "kitchen", completed: true },
      idempotencyKey: "checklist_1",
      now: "2026-10-05T15:00:00.000Z",
    });

    expect(evidenceCalls[0]?.[3]).toEqual({
      idempotencyKey: "evidence_1",
      expectedVersion: inProgressVisit.version,
      now: "2026-10-05T15:00:00.000Z",
    });
    expect(checklistCalls[0]?.[3]).toEqual({
      idempotencyKey: "checklist_1",
      expectedVersion: inProgressVisit.version,
      now: "2026-10-05T15:00:00.000Z",
    });
  });
});

describe("V2 operational exceptions", () => {
  it("combines derived field exceptions with the existing attention architecture", () => {
    let sync = createCrewSyncState(true);
    sync = reduceCrewSyncState(sync, { type: "QUEUE_OPERATION", operation });
    sync = reduceCrewSyncState(sync, {
      type: "VERSION_CONFLICT",
      operationId: operation.id,
      message: "stale local version",
      serverVersion: 8,
    });

    const exceptions = buildFieldOperationalExceptions({
      visit: { ...targetVisit, crewId: "crew_b", status: "IN_PROGRESS", startAt: "2026-10-05T13:00:00.000Z" },
      evidence: [],
      sync,
      now: "2026-10-05T14:30:00.000Z",
      scheduleCollision: true,
      attentionItems: dispatchSnapshot().attentionItems ?? [],
    });

    expect(exceptions.map((item) => item.code)).toEqual([
      "SCHEDULE_COLLISION",
      "MISSING_EVIDENCE",
      "QUALITY_ESCALATION",
      "STALE_VERSION",
    ]);
    expect(exceptions.find((item) => item.code === "QUALITY_ESCALATION")?.source).toBe("EXISTING_ATTENTION");
  });
});
