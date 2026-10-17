import { describe, expect, it } from "vitest";
import { buildWorkflowInspector } from "../../src/features/operations/workflow-inspector-model";

const version = { id: "v1", branchId: "b1", ruleId: "r1", versionNumber: 2,
  state: "PUBLISHED" as const, eventType: "QUOTE_ACCEPTED" as const,
  conditions: [], actions: [], maxActionsPerEvent: 3, createdAt: "2026-10-17T00:00:00Z" };
const live = { id: "e1", branchId: "b1", ruleId: "r1", ruleVersionId: "v1",
  mode: "LIVE" as const, eventType: "QUOTE_ACCEPTED", matched: true,
  recursionDepth: 0, state: "PARTIAL_FAILED" as const, createdAt: "2026-10-17T00:00:00Z" };
const action = { id: "a1", branchId: "b1", executionId: "e1", actionIndex: 0,
  attemptNumber: 1, actionType: "SEND_EMAIL_TEMPLATE" as const, state: "FAILED" as const,
  createdAt: "2026-10-17T00:01:00Z" };

describe("workflow inspector persisted proof", () => {
  it("excludes preview executions and never claims AI activity", () => {
    const runs = buildWorkflowInspector({ workflowAvailable: true,
      workflowRuleVersions: [version],
      workflowExecutions: [live, { ...live, id: "preview", mode: "PREVIEW" }],
      workflowActionExecutions: [action] });
    expect(runs).toHaveLength(1);
    expect(runs[0].versionNumber).toBe(2);
    expect(runs[0].aiEvidence).toContain("Not recorded");
    expect(runs[0].failedCount).toBe(1);
  });

  it("uses the latest action attempt rather than earlier failures", () => {
    const runs = buildWorkflowInspector({ workflowAvailable: true,
      workflowRuleVersions: [version], workflowExecutions: [live],
      workflowActionExecutions: [
        { ...action, id: "a2", attemptNumber: 2, state: "SUCCEEDED" },
        action,
      ] });
    expect(runs[0].attemptCount).toBe(2);
    expect(runs[0].actions).toHaveLength(1);
    expect(runs[0].actions[0].state).toBe("SUCCEEDED");
    expect(runs[0].failedCount).toBe(0);
  });

  it("does not attach unrelated actions or fabricate missing rule proof", () => {
    const runs = buildWorkflowInspector({ workflowAvailable: true,
      workflowRuleVersions: [], workflowExecutions: [live],
      workflowActionExecutions: [{ ...action, executionId: "other" }] });
    expect(runs[0].actions).toEqual([]);
    expect(runs[0].ruleEvidence).toBe("Rule version unavailable");
  });

  it("handles unavailable workflow data without inventing events", () => {
    expect(buildWorkflowInspector({ workflowAvailable: false })).toEqual([]);
  });
});
