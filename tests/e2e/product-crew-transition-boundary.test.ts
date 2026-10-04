import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { mapProductActionError } from "../../src/features/operations/action-state";
import {
  buildCrewTransitionPresentation,
  createCrewTransitionServerActionFactory,
  getCrewOperableTransitionAction,
} from "../../src/features/crew/server-boundary";
import { buildCrewFieldEvidenceBoundary } from "../../src/features/crew/field-evidence-boundary";

const root = process.cwd();
function source(path: string) { return readFileSync(join(root, path), "utf8"); }

const ctx = { workspaceId: "ws_1", role: "CREW", userId: "crew_1" } as const;
const baseVisit = {
  id: "visit_1",
  workspaceId: "ws_1",
  requestId: "req_1",
  quoteId: "quote_1",
  crewId: "crew_1",
  status: "ASSIGNED",
  startAt: "2026-10-04T06:00:00.000Z",
  serviceMinutes: 120,
  bufferMinutes: 30,
  version: 5,
} as const;

describe("E06 crew Product transition boundary", () => {
  it("maps only conservative crew transitions", () => {
    expect(getCrewOperableTransitionAction(baseVisit as never)).toBe("EN_ROUTE");
    expect(getCrewOperableTransitionAction({ ...baseVisit, status: "EN_ROUTE" } as never)).toBe("START");
    expect(getCrewOperableTransitionAction({ ...baseVisit, status: "IN_PROGRESS" } as never)).toBe("SUBMIT_REVIEW");
    expect(getCrewOperableTransitionAction({ ...baseVisit, status: "CONFIRMED" } as never)).toBeUndefined();
    expect(getCrewOperableTransitionAction({ ...baseVisit, status: "COMPLETED" } as never)).toBeUndefined();
  });

  it("calls transitionVisit with the exact Core signature and expectedVersion", async () => {
    const calls: unknown[][] = [];
    const action = createCrewTransitionServerActionFactory({
      async transitionVisit(...args) {
        calls.push(args);
        return { ok: true, value: { ...baseVisit, status: "EN_ROUTE", version: 6 } as never };
      },
    });

    const result = await action({
      ctx: ctx as never,
      visit: baseVisit as never,
      idempotencyKey: "idem_crew_1",
      now: "2026-10-04T15:00:00.000Z",
    });

    expect(result.ok).toBe(true);
    expect(calls).toEqual([
      [
        ctx,
        "visit_1",
        "EN_ROUTE",
        { idempotencyKey: "idem_crew_1", expectedVersion: 5, now: "2026-10-04T15:00:00.000Z" },
      ],
    ]);
  });

  it("rejects forbidden Product actions and avoids optimistic mutation", async () => {
    let callCount = 0;
    const action = createCrewTransitionServerActionFactory({
      async transitionVisit() {
        callCount += 1;
        return { ok: true, value: baseVisit as never };
      },
    });

    const forbidden = await action({
      ctx: ctx as never,
      visit: baseVisit as never,
      requestedAction: "COMPLETE",
      idempotencyKey: "idem_forbidden",
      now: "2026-10-04T15:00:00.000Z",
    });

    expect(forbidden.ok).toBe(false);
    expect(forbidden.state.status).toBe("invalid_transition");
    expect(callCount).toBe(0);
    expect(source("src/features/crew/server-boundary.ts")).not.toContain("{ ...input.visit");
  });

  it("labels field evidence as future/non-persisted", () => {
    const evidence = buildCrewFieldEvidenceBoundary();
    expect(evidence.persistence).toBe("FUTURE_E06_CORE_EVIDENCE");
    expect(evidence.submitEnabled).toBe(false);
    expect(source("src/features/crew/view-models.ts")).toContain("NOT_PERSISTED");
    expect(source("src/features/crew/view-models.ts")).not.toContain("complete:");
  });

  it("maps crew action errors", () => {
    expect(mapProductActionError({ code: "UNAUTHORIZED_CREW", message: "no" }).status).toBe("auth_required");
    expect(mapProductActionError({ code: "VISIT_NOT_FOUND", message: "missing" }).status).toBe("visit_not_found");
    expect(mapProductActionError({ code: "VISIT_WORKSPACE_MISMATCH", message: "wrong" }).status).toBe("workspace_denied");
    expect(mapProductActionError({ code: "INVALID_CREW_TRANSITION", message: "bad" }).status).toBe("invalid_transition");
    expect(mapProductActionError({ code: "VERSION_CONFLICT", message: "stale" }).status).toBe("version_conflict");
    expect(mapProductActionError({ code: "REVIEW_REQUIRED", message: "review" }).status).toBe("review_required");
  });

  it("keeps route coverage and provider/Core repository boundaries", () => {
    const route = source("src/features/operations/OperationalRoute.tsx");
    for (const required of ["BusinessPanel", "CustomerPanel", "StaffPanel", "CrewPanel", "InboxPreview", "CrmPreview", "ReportsPreview", "PlatformBillingPreview", "QualityReviewPreview", "RecoveryActionsPreview", "OwnerSettingsPreview", "OnboardingPanel", "TourPanel"]) {
      expect(route).toContain(required);
    }

    for (const path of ["src/features/crew/server-boundary.ts", "src/app/crew/today/server-actions.ts", "src/app/crew/jobs/[id]/server-actions.ts"]) {
      const file = source(path);
      expect(file).not.toContain("@/server/core/repositories");
      expect(file).not.toContain("@/server/integrations");
      expect(file).not.toContain("stripe");
      expect(file).not.toContain("whatsapp");
      expect(file).not.toContain("google-calendar");
    }
  });
});
