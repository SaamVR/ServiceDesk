import { describe, expect, it } from "vitest";
import type { CrewFieldReadSnapshot } from "../../src/features/crew/route-boundary";
import { createCrewFieldReadFactory } from "../../src/features/crew/route-boundary";
import { buildCrewTodayJobs } from "../../src/features/crew/v2-field-models";

const ctx = { workspaceId: "ws_1", role: "CREW", userId: "crew_user_1" } as const;

function snapshot(): CrewFieldReadSnapshot {
  return {
    workspaceId: "ws_1",
    workspaceTimeZone: "Europe/London",
    scope: "ASSIGNED_CREW_ONLY",
    requests: [{
      id: "req_1",
      workspaceId: "ws_1",
      customerId: "cust_1",
      propertyId: "prop_1",
      serviceCode: "MOVE_OUT",
      status: "BOOKED",
      version: 4,
      createdAt: "2026-10-04T08:00:00.000Z",
      updatedAt: "2026-10-04T08:10:00.000Z",
    }],
    visits: [{
      id: "visit_1",
      workspaceId: "ws_1",
      requestId: "req_1",
      quoteId: "quote_1",
      crewId: "crew_1",
      status: "ASSIGNED",
      startAt: "2026-10-05T09:00:00.000Z",
      serviceMinutes: 120,
      bufferMinutes: 30,
      version: 3,
    }],
    visitEvidence: [{
      id: "ev_1",
      workspaceId: "ws_1",
      visitId: "visit_1",
      kind: "BEFORE_PHOTO",
      mediaReference: { storageProvider: "supabase", objectRef: "private/before.jpg" },
      capturedAt: "2026-10-05T09:05:00.000Z",
      submittedByUserId: "crew_user_1",
      createdAt: "2026-10-05T09:05:00.000Z",
    }],
    visitChecklistItems: [{
      id: "check_1",
      workspaceId: "ws_1",
      visitId: "visit_1",
      itemKey: "kitchen",
      completed: true,
      updatedByUserId: "crew_user_1",
      updatedAt: "2026-10-05T09:10:00.000Z",
      version: 1,
    }],
    attentionItems: [{
      id: "attention_1",
      workspaceId: "ws_1",
      type: "FIELD_INCIDENT",
      severity: "WARNING",
      status: "OPEN",
      resourceType: "visit",
      resourceId: "visit_1",
      summary: "Access issue reported.",
    }],
    visitContexts: [{
      visitId: "visit_1",
      authorized: true,
      locationLabel: "10 Sample Street",
      customerLabel: "Customer",
      accessNotes: "Use side gate",
      serviceNotes: "Move-out clean",
      highPriorityNotes: ["Arrival note"],
    }],
  };
}

describe("crew production read boundary", () => {
  it("requires a signed-in crew actor before reading field data", async () => {
    let calls = 0;
    const loader = createCrewFieldReadFactory({
      async readCrewFieldSnapshot() {
        calls += 1;
        return { ok: true, value: snapshot() };
      },
    });

    const result = await loader.loadToday({ workspaceId: "ws_1", role: "DISPATCHER", userId: "dispatcher_1" }, "2026-10-05T08:00:00.000Z");
    expect(result).toMatchObject({ ok: false, code: "CREW_AUTH_REQUIRED" });
    expect(calls).toBe(0);
  });

  it("rejects cross-workspace data and unassigned visits", async () => {
    const cross = snapshot();
    cross.visits = [{ ...cross.visits[0]!, workspaceId: "ws_other" }];
    const loader = createCrewFieldReadFactory({
      async readCrewFieldSnapshot() {
        return { ok: true, value: cross };
      },
    });
    await expect(loader.loadToday(ctx, "2026-10-05T08:00:00.000Z")).resolves.toMatchObject({
      ok: false,
      code: "WORKSPACE_MISMATCH",
    });

    const unsafe = snapshot();
    unsafe.visits = [{ ...unsafe.visits[0]!, crewId: undefined }];
    const unsafeLoader = createCrewFieldReadFactory({
      async readCrewFieldSnapshot() {
        return { ok: true, value: unsafe };
      },
    });
    await expect(unsafeLoader.loadToday(ctx, "2026-10-05T08:00:00.000Z")).resolves.toMatchObject({
      ok: false,
      code: "CREW_SCOPE_INVALID",
    });
  });

  it("joins request, checklist, evidence and authorized context without inventing data", async () => {
    const loader = createCrewFieldReadFactory({
      async readCrewFieldSnapshot() {
        return { ok: true, value: snapshot() };
      },
    });
    const result = await loader.loadToday(ctx, "2026-10-05T08:00:00.000Z");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const jobs = buildCrewTodayJobs(result.value.jobs, "2026-10-05T08:00:00.000Z");
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      serviceLabel: "MOVE_OUT",
      locationLabel: "10 Sample Street",
      checklistProgressLabel: "1/1 checklist",
      evidenceProgressLabel: "1/2 photos",
      timeZoneLabel: "Europe/London",
    });
  });

  it("loads one selected job with only visit-scoped evidence, checklist and attention", async () => {
    const loader = createCrewFieldReadFactory({
      async readCrewFieldSnapshot(_ctx, query) {
        expect(query.visitId).toBe("visit_1");
        return { ok: true, value: snapshot() };
      },
    });
    const result = await loader.loadJob(ctx, "visit_1", "2026-10-05T08:00:00.000Z");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.job.visit.id).toBe("visit_1");
    expect(result.value.job.evidence).toHaveLength(1);
    expect(result.value.job.checklist).toHaveLength(1);
    expect(result.value.job.attentionItems).toHaveLength(1);
    expect(result.value.job.context.accessNotes).toBe("Use side gate");
  });
});
