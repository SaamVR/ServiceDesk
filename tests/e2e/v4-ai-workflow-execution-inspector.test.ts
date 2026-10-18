import { describe, expect, it } from "vitest";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {
  buildWorkflowInspector,
  buildWorkflowInterventionQueue,
  classifyWorkflowIntervention,
  isWorkflowAttentionRequired,
  summarizeWorkflowActivity,
} from "../../src/features/operations/workflow-inspector-model";

const version = {
  id: "v1", branchId: "b1", ruleId: "r1", versionNumber: 2,
  state: "PUBLISHED" as const, eventType: "QUOTE_ACCEPTED" as const,
  conditions: [], actions: [], maxActionsPerEvent: 3, createdAt: "2026-10-17T00:00:00Z",
};
const live = {
  id: "e1", branchId: "b1", ruleId: "r1", ruleVersionId: "v1",
  mode: "LIVE" as const, eventType: "QUOTE_ACCEPTED", matched: true,
  recursionDepth: 0, state: "PARTIAL_FAILED" as const,
  createdAt: "2026-10-17T00:00:00Z", completedAt: "2026-10-17T00:00:10Z",
};
const action = {
  id: "a1", branchId: "b1", executionId: "e1", actionIndex: 0,
  attemptNumber: 1, actionType: "SEND_EMAIL_TEMPLATE" as const,
  state: "FAILED" as const, createdAt: "2026-10-17T00:01:00Z",
};

const snapshot = () => ({
  workflowAvailable: true,
  workflowRuleVersions: [version],
  workflowExecutions: [live],
  workflowActionExecutions: [action],
});

describe("workflow inspector persisted evidence", () => {
  it("excludes preview decisions and never invents AI or provider receipts", () => {
    const runs = buildWorkflowInspector({
      ...snapshot(),
      workflowExecutions: [live, { ...live, id: "preview", mode: "PREVIEW" }],
    });
    expect(runs).toHaveLength(1);
    expect(runs[0].versionNumber).toBe(2);
    expect(runs[0].aiEvidence).toContain("Not recorded");
    expect(runs[0].failedCount).toBe(1);
    expect(runs[0].ruleEvidence).toBe("Persisted matching rule version");
  });

  it("selects highest attempt regardless of array order and excludes replayed old failure", () => {
    const runs = buildWorkflowInspector({
      ...snapshot(),
      workflowActionExecutions: [
        { ...action, id: "a2", attemptNumber: 2, state: "SUCCEEDED" },
        action,
      ],
    });
    expect(runs[0].attemptCount).toBe(2);
    expect(runs[0].attemptHistory.map(attempt => attempt.id)).toEqual(["a2", "a1"]);
    expect(runs[0].actions).toHaveLength(1);
    expect(runs[0].actions[0].state).toBe("SUCCEEDED");
    expect(runs[0].failedCount).toBe(0);
    expect(summarizeWorkflowActivity(runs).recordedSucceededActions).toBe(1);
  });

  it("retains historical failed attempts without treating them as current failure", () => {
    const runs = buildWorkflowInspector({
      ...snapshot(),
      workflowActionExecutions: [
        { ...action, id: "retry-3", attemptNumber: 3, state: "SUCCEEDED" },
        { ...action, id: "retry-2", attemptNumber: 2, state: "FAILED" },
        { ...action, id: "retry-1", attemptNumber: 1, state: "FAILED" },
        { ...action, id: "foreign", branchId: "b2", attemptNumber: 9, state: "SUCCEEDED" },
      ],
    });
    expect(runs[0].attemptHistory.map(row => row.id))
      .toEqual(["retry-3", "retry-2", "retry-1"]);
    expect(runs[0].attemptCount).toBe(3);
    expect(runs[0].actions[0].id).toBe("retry-3");
    expect(runs[0].failedCount).toBe(0);
    expect(summarizeWorkflowActivity(runs).recordedSucceededActions).toBe(1);
  });

  it("fails closed on conflicting latest attempts instead of choosing by timestamp or ID", () => {
    const runs = buildWorkflowInspector({
      ...snapshot(),
      workflowExecutions: [{ ...live, state: "ACTIONS_PENDING" }],
      workflowActionExecutions: [
        { ...action, id: "aa", attemptNumber: 3, state: "PENDING" },
        { ...action, id: "ab", attemptNumber: 3, state: "SUCCEEDED" },
      ],
    });
    expect(runs[0].actions).toEqual([]);
    expect(runs[0].ambiguousActionSlots).toBe(1);
    expect(runs[0].attemptHistory).toHaveLength(2);
    expect(runs[0].succeededCount).toBe(0);
    expect(summarizeWorkflowActivity(runs).recordedSucceededActions).toBe(0);
    expect(summarizeWorkflowActivity(runs).ambiguousActionSlots).toBe(1);
    expect(classifyWorkflowIntervention(runs[0])).toBe("ambiguous");
    expect(isWorkflowAttentionRequired(runs[0])).toBe(true);
    expect(buildWorkflowInterventionQueue(runs)[0].kind).toBe("ambiguous");
  });
  it("does not promote success or completed KPIs when an action contradicts an unmatched event", () => {
    for (const state of ["COMPLETED", "SKIPPED"] as const) {
      const runs = buildWorkflowInspector({
        ...snapshot(),
        workflowExecutions: [{ ...live, matched: false, state }],
        workflowActionExecutions: [{ ...action, state: "SUCCEEDED" }],
      });
      expect(runs[0].actions).toEqual([]);
      expect(runs[0].attemptHistory).toHaveLength(1);
      expect(runs[0].ambiguousActionSlots).toBe(1);
      expect(runs[0].succeededCount).toBe(0);
      expect(summarizeWorkflowActivity(runs).recordedSucceededActions).toBe(0);
      expect(summarizeWorkflowActivity(runs).completed).toBe(0);
      expect(buildWorkflowInterventionQueue(runs)[0].kind).toBe("ambiguous");
    }
  });

  it("requires one stable action type for the entire retry chain", () => {
    const runs = buildWorkflowInspector({
      ...snapshot(),
      workflowExecutions: [{ ...live, state: "ACTIONS_PENDING" }],
      workflowActionExecutions: [
        { ...action, id: "old", attemptNumber: 1, actionType: "SEND_EMAIL_TEMPLATE", state: "FAILED" },
        { ...action, id: "new", attemptNumber: 2, actionType: "CREATE_ATTENTION", state: "SUCCEEDED" },
      ],
    });
    expect(runs[0].actions).toEqual([]);
    expect(runs[0].ambiguousActionSlots).toBe(1);
    expect(runs[0].attemptHistory).toHaveLength(2);
  });

  it("rejects actions from a different branch even if their execution IDs collide", () => {
    const runs = buildWorkflowInspector({
      ...snapshot(),
      workflowActionExecutions: [
        { ...action, branchId: "another-tenant", state: "SUCCEEDED" },
      ],
    });
    expect(runs[0].actions).toEqual([]);
    expect(runs[0].attemptCount).toBe(0);
  });

  it("rejects rule version with mismatched rule or branch identity", () => {
    const cases = [{ ...version, branchId: "different" }, { ...version, ruleId: "r2" }];
    for (const mismatch of cases) {
      const runs = buildWorkflowInspector({
        ...snapshot(),
        workflowRuleVersions: [mismatch],
      });
      expect(runs[0].versionNumber).toBeUndefined();
      expect(runs[0].ruleEvidence).toContain("identity mismatched");
    }
  });

  it("excludes malformed action counters instead of treating them as evidence", () => {
    const runs = buildWorkflowInspector({
      ...snapshot(),
      workflowActionExecutions: [
        { ...action, actionIndex: -1 },
        { ...action, attemptNumber: 0 },
        { ...action, attemptNumber: Number.NaN },
        { ...action, id: "valid" },
      ],
    });
    expect(runs[0].attemptCount).toBe(1);
    expect(runs[0].actions[0].id).toBe("valid");
  });

  it("does not attach actions with unrelated execution IDs", () => {
    const runs = buildWorkflowInspector({
      ...snapshot(),
      workflowActionExecutions: [{ ...action, executionId: "other" }],
    });
    expect(runs[0].actions).toEqual([]);
  });

  it("computes metrics only from persisted current action outcomes", () => {
    const runs = buildWorkflowInspector({
      ...snapshot(),
      workflowActionExecutions: [
        { ...action, state: "APPROVAL_REQUIRED" },
        { ...action, id: "a2", actionIndex: 1, state: "SUCCEEDED" },
      ],
    });
    const summary = summarizeWorkflowActivity(runs);
    expect(summary.runs).toBe(1);
    expect(summary.waitingForApproval).toBe(1);
    expect(summary.pendingActions).toBe(1);
    expect(summary.recordedSucceededActions).toBe(1);
    expect(summary.measuredDurationMs).toEqual([10_000]);
    expect(isWorkflowAttentionRequired(runs[0])).toBe(true);
  });

  it("does not mark an otherwise completed run clean when current retry evidence conflicts", () => {
    const runs = buildWorkflowInspector({
      ...snapshot(),
      workflowExecutions: [{ ...live, state: "COMPLETED" }],
      workflowActionExecutions: [
        { ...action, id: "conflict-a", attemptNumber: 5, state: "SUCCEEDED" },
        { ...action, id: "conflict-b", attemptNumber: 5, state: "FAILED" },
      ],
    });
    expect(runs[0].ambiguousActionSlots).toBe(1);
    expect(summarizeWorkflowActivity(runs).completed).toBe(0);
    const source=readFileSync(join(process.cwd(),"src/features/operations/WorkflowExecutionInspector.tsx"),"utf8");
    expect(source).toContain('run.ambiguousActionSlots === 0');
    expect(summarizeWorkflowActivity(runs).recordedSucceededActions).toBe(0);
  });

  it("rejects unzoned and impossible source timestamps for efficiency metrics", () => {
    const runs = buildWorkflowInspector({
      ...snapshot(),
      workflowExecutions: [
        { ...live, id:"naive",createdAt:"2026-10-17T00:00:00",completedAt:"2026-10-17T00:00:10Z" },
        { ...live, id:"impossible",createdAt:"2026-02-30T00:00:00Z",completedAt:"2026-03-01T00:00:00Z" },
      ],
    });
    expect(summarizeWorkflowActivity(runs).measuredDurationMs).toEqual([]);
  });

  it("discards invalid or negative elapsed times, never fabricates efficiency savings", () => {
    const runs = buildWorkflowInspector({
      ...snapshot(),
      workflowExecutions: [
        { ...live, completedAt: "2026-10-16T23:59:59Z" },
        { ...live, id: "e2", completedAt: "not-a-timestamp" },
      ],
    });
    expect(summarizeWorkflowActivity(runs).measuredDurationMs).toEqual([]);
  });

  it("does not treat ordinary processing as an operator approval or recovery task", () => {
    const processing = buildWorkflowInspector({
      ...snapshot(),
      workflowExecutions: [{ ...live, state: "ACTIONS_PENDING" }],
      workflowActionExecutions: [{ ...action, state: "PENDING" }],
    });
    expect(classifyWorkflowIntervention(processing[0])).toBe("processing");
    expect(isWorkflowAttentionRequired(processing[0])).toBe(false);
    expect(buildWorkflowInterventionQueue(processing)).toEqual([]);
  });

  it("shows actual APPROVAL_REQUIRED actions as actionable, not automatic execution", () => {
    const pendingApproval = buildWorkflowInspector({
      ...snapshot(),
      workflowExecutions: [{ ...live, state: "ACTIONS_PENDING" }],
      workflowActionExecutions: [{ ...action, state: "APPROVAL_REQUIRED" }],
    });
    const queue = buildWorkflowInterventionQueue(pendingApproval);
    expect(queue).toHaveLength(1);
    expect(queue[0].kind).toBe("approval");
    expect(queue[0].run.approvalCount).toBe(1);
    expect(isWorkflowAttentionRequired(queue[0].run)).toBe(true);
  });

  it("prioritizes persisted failures above approval waits without inventing severity scores", () => {
    const mixed = buildWorkflowInspector({
      ...snapshot(),
      workflowExecutions: [
        live,
        { ...live, id: "approve-later", createdAt: "2026-10-18T00:00:00Z", state: "ACTIONS_PENDING" },
      ],
      workflowActionExecutions: [
        action,
        { ...action, id: "approval-action", executionId: "approve-later",
          state: "APPROVAL_REQUIRED" },
      ],
    });
    const queue = buildWorkflowInterventionQueue(mixed);
    expect(queue.map(item => item.kind)).toEqual(["failure", "approval"]);
    expect(queue.map(item => item.run.id)).toEqual(["e1", "approve-later"]);
  });

  it("hides executions when the workflow evidence feature is unavailable", () => {
    expect(buildWorkflowInspector({ ...snapshot(), workflowAvailable: false })).toEqual([]);
    expect(buildWorkflowInspector({ workflowAvailable: false })).toEqual([]);
    expect(buildWorkflowInspector({ ...snapshot(), workflowAvailable: undefined })).toEqual([]);
  });
});
