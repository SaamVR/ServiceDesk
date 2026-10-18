import { describe, expect, it } from "vitest";
import { summarizeWorkflowEvidence } from "../../src/features/operations/workflow-evidence-summary";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  OperationalWorkflowExecution, OperationalWorkflowActionExecution,
} from "../../src/features/operations/operational-product-runtime";

const live: OperationalWorkflowExecution = {
  id: "run-1", branchId: "branch-one", ruleId: "r", ruleVersionId: "rv",
  mode: "LIVE", matched: true, eventType: "REQUEST_CREATED",
  recursionDepth: 0, state: "COMPLETED", createdAt: "2026-10-18T01:00:00Z",
};
const attempt = (id: string, attemptNumber: number,
  state: OperationalWorkflowActionExecution["state"]):
  OperationalWorkflowActionExecution => ({
    id, executionId: "run-1", branchId: "branch-one",
    actionIndex: 0, attemptNumber, state,
    actionType: "CREATE_ATTENTION", createdAt: "2026-10-18T01:02:00Z",
  });

describe("SONIC workflow retry and false-outcome evidence review", () => {
  it("discloses snapshot caps rather than claiming all historical attempts", () => {
    const strip = readFileSync(join(process.cwd(), "src/features/operations/WorkflowEvidenceStrip.tsx"),"utf8");
    const status = readFileSync(join(process.cwd(), "src/features/operations/AiOperationsStatus.tsx"),"utf8");
    expect(strip).toContain("1,000");
    expect(strip).toContain("2,000 before branch filtering");
    expect(status).toContain("source capped before branch filtering");
    expect(status).toContain("conflicting action slot(s) need operator review");
    expect(strip).toContain("evidence.failedActions + evidence.externalApprovalRequired +");
    expect(strip).toContain("Review failed, ambiguous and approval-required items");
  });
  it("counts the latest successful retry, not the preceding failed attempt", () => {
    const result = summarizeWorkflowEvidence({
      workflowExecutions: [live],
      workflowActionExecutions: [
        attempt("first", 1, "FAILED"), attempt("second", 2, "SUCCEEDED"),
      ],
    });
    expect(result.failedActions).toBe(0);
    expect(result.internalAttentionSucceeded).toBe(1);
    expect(result.recordedActionAttempts).toBe(2);
    expect(result.historicalActionAttempts).toBe(1);
    expect(result.providerDeliveryVerified).toBe(false);
    expect(result.historicalActionAttempts).toBe(1);
  });
  it("does not count older successes after a current failed attempt", () => {
    const result = summarizeWorkflowEvidence({
      workflowExecutions: [live],
      workflowActionExecutions: [
        attempt("first", 1, "SUCCEEDED"), attempt("second", 3, "FAILED"),
      ],
    });
    expect(result.internalAttentionSucceeded).toBe(0);
    expect(result.failedActions).toBe(1);
  });
  it("rejects duplicate highest attempts and action identity drift as ambiguous", () => {
    for (const rows of [
      [attempt("x", 3, "FAILED"), attempt("y", 3, "SUCCEEDED")],
      [attempt("x", 1, "FAILED"), { ...attempt("y", 2, "SUCCEEDED"),
        actionType: "SEND_EMAIL_TEMPLATE" as const }],
    ]) {
      const result = summarizeWorkflowEvidence({
        workflowExecutions: [live], workflowActionExecutions: rows,
      });
      expect(result.ambiguousActionSlots).toBe(1);
      expect(result.internalAttentionSucceeded).toBe(0);
      expect(result.failedActions).toBe(0);
      expect(result.providerDeliveryVerified).toBe(false);
    }
  });
  it("flags action records for unmatched or skipped live decisions as inconsistent, not successful", () => {
    for (const record of [
      {...live,matched:false,state:"COMPLETED" as const},
      {...live,matched:true,state:"SKIPPED" as const},
    ]) {
      const result=summarizeWorkflowEvidence({
        workflowExecutions:[record],
        workflowActionExecutions:[attempt("false-success",1,"SUCCEEDED")],
      });
      expect(result.recordedActionAttempts).toBe(1);
      expect(result.ambiguousActionSlots).toBe(1);
      expect(result.internalAttentionSucceeded).toBe(0);
      expect(result.failedActions).toBe(0);
      expect(result.providerDeliveryVerified).toBe(false);
    }
  });
  it("ignores foreign branches and previews even when their receipts say SUCCESS", () => {
    const result = summarizeWorkflowEvidence({
      workflowExecutions: [live, {...live,id:"preview",mode:"PREVIEW"}],
      workflowActionExecutions: [
        {...attempt("foreign",1,"SUCCEEDED"),branchId:"branch-two"},
        {...attempt("preview-attempt",1,"SUCCEEDED"),executionId:"preview"},
      ],
    });
    expect(result.recordedActionAttempts).toBe(0);
    expect(result.internalAttentionSucceeded).toBe(0);
    expect(result.providerDeliveryVerified).toBe(false);
  });
});
