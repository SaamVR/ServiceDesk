import { describe, expect, it } from "vitest";
import { summarizeOwnerAttentionTriage } from "@/features/operations/owner-attention-triage";
import { planOwnerAttentionReviewPlaybook } from "@/features/operations/owner-attention-review-playbook";

type Input = Parameters<typeof summarizeOwnerAttentionTriage>[0];
const at = "2026-10-29T11:00:00Z";
const run = { id: "shared-execution", branchId: "branch-a", ruleId: "rule-a",
  ruleVersionId: "version-a", mode: "LIVE", eventType: "QUOTE_ACCEPTED",
  matched: true, recursionDepth: 0, state: "COMPLETED", createdAt: at } as const;
const action = { id: "attempt-a", executionId: run.id, branchId: run.branchId,
  actionIndex: 0, attemptNumber: 1, actionType: "CREATE_ATTENTION",
  state: "SUCCEEDED", createdAt: at } as const;
const attention = { id: "attention-a", type: "WORKFLOW_RULE",
  resourceType: "workflow_execution", resourceId: run.id,
  status: "OPEN", severity: "WARNING", summary: "Internal review",
  dueAt: "2026-10-29T10:00:00Z" } as const;
const scope: Input["branchScope"] = {
  mode: "BRANCH", selectedBranchId: "branch-a",
  branches: [
    { id: "branch-a", code: "A", name: "Authorized", currency: "USD",
      timezone: "UTC", isDefault: true },
    { id: "branch-b", code: "B", name: "Other", currency: "USD",
      timezone: "UTC", isDefault: false },
  ],
};
const input: Input = { loadedAt: at, workflowAvailable: true,
  branchScope: scope, workflowExecutions: [run],
  workflowActionExecutions: [action], attentionItems: [attention],
};

describe("P43 duplicate LIVE execution identity quarantine", () => {
  it("keeps a unique authorized execution actionable", () => {
    expect(summarizeOwnerAttentionTriage(input)).toMatchObject({
      state: "AVAILABLE", open: 1, overdue: 1,
      ambiguous: 0, missingActionEvidence: 0,
    });
  });
  it("quarantines conflicting same-ID LIVE rows rather than Map-last-wins", () => {
    const triage = summarizeOwnerAttentionTriage({ ...input,
      workflowExecutions: [run, { ...run, ruleId: "different-rule" }],
    });
    expect(triage).toMatchObject({ state: "AVAILABLE", open: 0, overdue: 0,
      critical: 0, missingActionEvidence: 0, ambiguous: 1, review: [] });
    expect(planOwnerAttentionReviewPlaybook(triage).steps[0].id)
      .toBe("inspect-quarantined");
  });
  it("also quarantines identical and triplicated saved identities once per ID", () => {
    for (const runs of [[run, { ...run }], [run, { ...run }, { ...run }]]) {
      const result = summarizeOwnerAttentionTriage({ ...input, workflowExecutions: runs });
      expect(result).toMatchObject({ open: 0, ambiguous: 1 });
    }
  });
  it("detects repeated IDs across two authorized branches in WORKSPACE mode", () => {
    const triage = summarizeOwnerAttentionTriage({ ...input,
      branchScope: { ...scope!, mode: "ALL" },
      workflowExecutions: [run, { ...run, branchId: "branch-b" }],
    });
    expect(triage).toMatchObject({ state: "AVAILABLE", open: 0, ambiguous: 1 });
  });
  it("does not reveal foreign-branch duplicates in selected BRANCH mode", () => {
    const result = summarizeOwnerAttentionTriage({ ...input,
      workflowExecutions: [run, { ...run, branchId: "branch-b" },
        { ...run, branchId: "branch-b" }],
    });
    expect(result).toMatchObject({ state: "AVAILABLE", open: 1, ambiguous: 0 });
  });
  it("ignores non-LIVE and unmatched replay rows instead of corrupting actual evidence", () => {
    const result = summarizeOwnerAttentionTriage({ ...input,
      workflowExecutions: [run, { ...run, mode: "PREVIEW" },
        { ...run, matched: false }],
    });
    expect(result).toMatchObject({ open: 1, ambiguous: 0 });
  });
});
