import { describe, expect, it } from "vitest";
import {
  buildWorkflowInspector,
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
    expect(runs[0].actions).toHaveLength(1);
    expect(runs[0].actions[0].state).toBe("SUCCEEDED");
    expect(runs[0].failedCount).toBe(0);
    expect(summarizeWorkflowActivity(runs).recordedSucceededActions).toBe(1);
  });

  it("resolves same-attempt ties deterministically by timestamp then ID", () => {
    const runs = buildWorkflowInspector({
      ...snapshot(),
      workflowActionExecutions: [
        { ...action, id: "aa", attemptNumber: 3, state: "PENDING" },
        { ...action, id: "ab", attemptNumber: 3, state: "APPROVAL_REQUIRED" },
      ],
    });
    expect(runs[0].actions[0].id).toBe("ab");
    expect(runs[0].approvalCount).toBe(1);
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

  it("hides executions when the workflow evidence feature is unavailable", () => {
    expect(buildWorkflowInspector({ ...snapshot(), workflowAvailable: false })).toEqual([]);
    expect(buildWorkflowInspector({ workflowAvailable: false })).toEqual([]);
  });
});
