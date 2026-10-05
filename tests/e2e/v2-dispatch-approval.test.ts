import { describe, expect, it } from "vitest";
import type { DispatchSnapshot } from "../../src/features/dispatch/recommendations";
import { buildDispatchRecommendations } from "../../src/features/dispatch/recommendations";
import {
  buildDispatchAssignmentAvailability,
  createDispatcherAssignmentApprovalFactory,
  requiredCoreAssignmentContract,
} from "../../src/features/dispatch/assignment-boundary";

const ctx = { workspaceId: "ws_1", role: "DISPATCHER", userId: "dispatcher_1" } as const;

function snapshot(version = 7): DispatchSnapshot {
  return {
    visits: [{
      id: "visit_1",
      workspaceId: "ws_1",
      requestId: "req_1",
      quoteId: "quote_1",
      status: "CONFIRMED",
      startAt: "2026-10-05T13:00:00.000Z",
      serviceMinutes: 120,
      bufferMinutes: 30,
      version,
      serviceCode: "MOVE_OUT",
    }],
    crews: [{
      id: "crew_1",
      workspaceId: "ws_1",
      active: true,
      availableFrom: "2026-10-05T08:00:00.000Z",
      availableTo: "2026-10-05T18:00:00.000Z",
      serviceCodes: ["MOVE_OUT"],
    }],
  };
}

describe("V2 dispatcher assignment approval boundary", () => {
  it("publishes the exact missing Core command shape and stays disabled without it", async () => {
    expect(requiredCoreAssignmentContract.signature).toContain("assignCrew");
    expect(requiredCoreAssignmentContract.protections).toContain("expected visit version");

    const recommendations = buildDispatchRecommendations(snapshot());
    const factory = createDispatcherAssignmentApprovalFactory();
    expect(buildDispatchAssignmentAvailability()).toMatchObject({ enabled: false });
    expect(factory.availability.enabled).toBe(false);

    const result = await factory.approve({
      ctx,
      recommendation: recommendations[0]!,
      candidateCrewId: "crew_1",
      freshSnapshot: snapshot(),
      idempotencyKey: "assign_1",
      now: "2026-10-05T12:00:00.000Z",
    });
    expect(result).toMatchObject({
      ok: false,
      code: "DISPATCH_ASSIGNMENT_COMMAND_UNAVAILABLE",
      rebuildRecommendation: false,
    });
  });

  it("rejects stale recommendation versions before any assignment command runs", async () => {
    let calls = 0;
    const factory = createDispatcherAssignmentApprovalFactory({
      async assignCrew() {
        calls += 1;
        throw new Error("must not run");
      },
    });
    const recommendation = buildDispatchRecommendations(snapshot(7))[0]!;

    const result = await factory.approve({
      ctx,
      recommendation,
      candidateCrewId: "crew_1",
      freshSnapshot: snapshot(8),
      idempotencyKey: "assign_stale",
      now: "2026-10-05T12:00:00.000Z",
    });

    expect(result).toMatchObject({
      ok: false,
      code: "DISPATCH_RECOMMENDATION_STALE",
      rebuildRecommendation: true,
    });
    expect(calls).toBe(0);
  });

  it("rechecks current conflicts before mutation", async () => {
    let calls = 0;
    const factory = createDispatcherAssignmentApprovalFactory({
      async assignCrew() {
        calls += 1;
        throw new Error("must not run");
      },
    });
    const recommendation = buildDispatchRecommendations(snapshot())[0]!;
    const conflicted = snapshot();
    conflicted.visits = [
      ...conflicted.visits,
      {
        id: "visit_existing",
        workspaceId: "ws_1",
        requestId: "req_2",
        quoteId: "quote_2",
        crewId: "crew_1",
        status: "ASSIGNED",
        startAt: "2026-10-05T13:30:00.000Z",
        serviceMinutes: 90,
        bufferMinutes: 30,
        version: 2,
      },
    ];

    const result = await factory.approve({
      ctx,
      recommendation,
      candidateCrewId: "crew_1",
      freshSnapshot: conflicted,
      idempotencyKey: "assign_conflict",
      now: "2026-10-05T12:00:00.000Z",
    });

    expect(result).toMatchObject({
      ok: false,
      code: "DISPATCH_CANDIDATE_CONFLICT",
      rebuildRecommendation: true,
    });
    expect(calls).toBe(0);
  });

  it("calls the authoritative command only after fresh role/workspace/version/eligibility checks", async () => {
    const calls: unknown[][] = [];
    const factory = createDispatcherAssignmentApprovalFactory({
      async assignCrew(...args) {
        calls.push(args);
        return {
          ok: true,
          value: {
            ...snapshot().visits[0]!,
            crewId: "crew_1",
            status: "ASSIGNED",
            version: 8,
          },
        };
      },
    });
    const fresh = snapshot();
    const recommendation = buildDispatchRecommendations(fresh)[0]!;
    const before = JSON.stringify(fresh);

    const result = await factory.approve({
      ctx,
      recommendation,
      candidateCrewId: "crew_1",
      freshSnapshot: fresh,
      idempotencyKey: "assign_ok",
      now: "2026-10-05T12:00:00.000Z",
    });

    expect(result.ok).toBe(true);
    expect(calls).toEqual([[
      ctx,
      "visit_1",
      { crewId: "crew_1" },
      { idempotencyKey: "assign_ok", expectedVersion: 7, now: "2026-10-05T12:00:00.000Z" },
    ]]);
    expect(JSON.stringify(fresh)).toBe(before);
  });

  it("rejects actors and crews outside the workspace", async () => {
    const recommendation = buildDispatchRecommendations(snapshot())[0]!;
    const factory = createDispatcherAssignmentApprovalFactory();

    await expect(factory.approve({
      ctx: { workspaceId: "ws_1", role: "CREW", userId: "crew_user" },
      recommendation,
      candidateCrewId: "crew_1",
      freshSnapshot: snapshot(),
      idempotencyKey: "assign_forbidden",
      now: "2026-10-05T12:00:00.000Z",
    })).resolves.toMatchObject({ ok: false, code: "DISPATCH_APPROVAL_FORBIDDEN" });

    const wrongCrew = snapshot();
    wrongCrew.crews = [{ ...wrongCrew.crews[0]!, workspaceId: "ws_other" }];
    const wrongRecommendation = buildDispatchRecommendations(wrongCrew)[0]!;
    expect(wrongRecommendation.candidates[0]?.conflicts).toContain("CREW_WORKSPACE_MISMATCH");
  });
});
