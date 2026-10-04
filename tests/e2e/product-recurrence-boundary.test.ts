import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { mapProductActionError } from "../../src/features/operations/action-state";
import { buildCrewFieldEvidenceBoundary } from "../../src/features/crew/field-evidence-boundary";
import { buildRecurrenceRuleView } from "../../src/features/recurrence/view-models";
import { createRecurrenceServerActionFactory } from "../../src/features/recurrence/server-boundary";

const root = process.cwd();
function source(path: string) { return readFileSync(join(root, path), "utf8"); }

const rule = {
  id: "rule_1",
  workspaceId: "ws_1",
  requestId: "req_1",
  propertyId: "prop_1",
  frequency: "MONTHLY",
  timezone: "America/New_York",
  localStartTime: "09:00",
  startsOn: "2026-11-01",
  maxOccurrences: 12,
  generatedOccurrences: 2,
  status: "ACTIVE",
  nextOccurrenceOn: "2026-12-01",
  version: 5,
  createdAt: "2026-10-04T06:00:00.000Z",
  updatedAt: "2026-10-04T06:00:00.000Z",
} as const;

const visit = {
  id: "visit_1",
  workspaceId: "ws_1",
  requestId: "req_1",
  quoteId: "quote_1",
  crewId: "crew_1",
  status: "ASSIGNED",
  startAt: "2026-12-01T09:00:00.000Z",
  serviceMinutes: 120,
  bufferMinutes: 30,
  version: 1,
} as const;

const ctx = { workspaceId: "ws_1", role: "DISPATCHER", userId: "user_1" } as const;

describe("E07 recurrence Product boundary", () => {
  it("renders only authoritative recurrence fields and materialized VisitDTO cards", () => {
    const view = buildRecurrenceRuleView({ rule: rule as never, materializedVisits: [visit as never], audience: "staff", actionsInjected: true });
    expect(view.nextOccurrenceLabel).toBe("2026-12-01");
    expect(view.authoritativeNextOccurrence).toBe(rule.nextOccurrenceOn);
    expect(view.materializedVisitCards).toEqual([{ id: "visit_1", status: "ASSIGNED", startAt: visit.startAt, crewLabel: "crew_1" }]);
  });

  it("keeps customer recurrence mutations disabled", () => {
    const view = buildRecurrenceRuleView({ rule: rule as never, audience: "customer", actionsInjected: true });
    expect(view.actionAvailability.controls.every((control) => control.enabled === false)).toBe(true);
  });

  it("delegates create and action commands with exact Core signatures and no optimism", async () => {
    const calls: string[] = [];
    const factory = createRecurrenceServerActionFactory({
      async createRecurrenceRule(ctxArg, input, meta) {
        calls.push(`create:${ctxArg.workspaceId}:${input.frequency}:${meta.idempotencyKey}`);
        return { ok: true, value: rule as never };
      },
      async applyRecurrenceRuleAction(ctxArg, id, action, meta) {
        calls.push(`action:${ctxArg.workspaceId}:${id}:${action}:${meta.expectedVersion}:${meta.idempotencyKey}:${meta.now}`);
        return { ok: true, value: { ...(rule as object), status: action === "PAUSE" ? "PAUSED" : "ACTIVE", version: rule.version + 1 } as never };
      },
    });

    expect((await factory.createRule({ ctx: ctx as never, input: { requestId: "req_1", propertyId: "prop_1", frequency: "MONTHLY", timezone: "America/New_York", localStartTime: "09:00", startsOn: "2026-11-01" }, meta: { idempotencyKey: "idem_create", now: "2026-10-04T06:00:00.000Z" } })).ok).toBe(true);
    const paused = await factory.applyAction({ ctx: ctx as never, rule: rule as never, action: "PAUSE", idempotencyKey: "idem_pause", now: "2026-10-04T06:01:00.000Z" });
    expect(paused.ok).toBe(true);
    expect(paused.value?.status).toBe("PAUSED");
    expect(calls).toEqual([
      "create:ws_1:MONTHLY:idem_create",
      "action:ws_1:rule_1:PAUSE:5:idem_pause:2026-10-04T06:01:00.000Z",
    ]);
  });

  it("maps recurrence action failures", () => {
    expect(mapProductActionError({ code: "RECURRENCE_RULE_NOT_FOUND", message: "missing" }).status).toBe("recurrence_rule_not_found");
    expect(mapProductActionError({ code: "RECURRENCE_VERSION_CONFLICT", message: "stale" }).status).toBe("version_conflict");
    expect(mapProductActionError({ code: "RECURRENCE_UNAUTHORIZED", message: "no" }).status).toBe("auth_required");
    expect(mapProductActionError({ code: "INVALID_RECURRENCE_CONFIGURATION", message: "bad" }).status).toBe("invalid_recurrence_configuration");
    expect(mapProductActionError({ code: "COMPLETED_RECURRENCE_RULE", message: "done" }).status).toBe("completed_recurrence_rule");
    expect(mapProductActionError({ code: "SKIP_UNAVAILABLE", message: "skip" }).status).toBe("skip_unavailable");
  });

  it("keeps field evidence compatible with frozen DTOs but disabled for submit", () => {
    const boundary = buildCrewFieldEvidenceBoundary({
      sourceLabel: "SERVER_SNAPSHOT",
      evidence: [{ id: "ev_1", workspaceId: "ws_1", visitId: "visit_1", kind: "BEFORE_PHOTO", mediaReference: { storageProvider: "fixture", objectRef: "before.jpg" }, capturedAt: "2026-10-04T06:00:00.000Z", submittedByUserId: "crew_1", createdAt: "2026-10-04T06:00:00.000Z" }],
      checklistItems: [{ id: "check_1", workspaceId: "ws_1", visitId: "visit_1", itemKey: "rooms", completed: true, updatedByUserId: "crew_1", updatedAt: "2026-10-04T06:00:00.000Z", version: 1 }],
    });
    expect(boundary.submitEnabled).toBe(false);
    expect(boundary.photoSlots[0].state).toBe("PERSISTED");
    expect(boundary.checklistItems).toHaveLength(1);
  });

  it("has no Product recurrence date generation or provider/Core repository imports", () => {
    for (const path of ["src/features/recurrence/view-models.ts", "src/features/recurrence/server-boundary.ts", "src/features/recurrence/RecurrenceRulePreview.tsx"]) {
      const file = source(path);
      expect(file).not.toContain("new Date(");
      expect(file).not.toContain("setDate(");
      expect(file).not.toContain("addDays");
      expect(file).not.toContain("RRule");
      expect(file).not.toContain("@/server/core/repositories");
      expect(file).not.toContain("@/server/integrations");
    }
  });
});
