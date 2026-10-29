import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { summarizeOwnerAttentionTriage } from "@/features/operations/owner-attention-triage";

type Input = Parameters<typeof summarizeOwnerAttentionTriage>[0];
const a = "authorized-branch";
const b = "other-branch";
const at = "2026-10-29T11:00:00Z";
const parent = { id: "run-a", branchId: a, ruleId: "rule-a", ruleVersionId: "version-a",
  mode: "LIVE", eventType: "QUOTE_ACCEPTED", matched: true, recursionDepth: 0,
  state: "COMPLETED", createdAt: at } as const;
const action = { id: "attempt-a", executionId: parent.id, branchId: a, attemptNumber: 1,
  actionIndex: 0, actionType: "CREATE_ATTENTION", state: "SUCCEEDED", createdAt: at } as const;
const attention = { id: "attention-a", type: "WORKFLOW_RULE", resourceType: "workflow_execution",
  resourceId: parent.id, severity: "CRITICAL", status: "OPEN", summary: "Staff review",
  dueAt: "2026-10-29T10:00:00Z" } as const;
const sample: Input = {
  loadedAt: at, workflowAvailable: true,
  branchScope: { mode: "BRANCH", selectedBranchId: a,
    branches: [{ id: a, code: "A", name: "Authorized", timezone: "UTC",
      currency: "USD", isDefault: true }, { id: b, code: "B", name: "Other",
      timezone: "UTC", currency: "USD", isDefault: false }] },
  workflowExecutions: [parent],
  workflowActionExecutions: [action],
  attentionItems: [attention],
};
describe("P33 owner attention triage - scoped current evidence", () => {
  it("prioritizes overdue critical saved attention with a successful current internal action", () => {
    const summary = summarizeOwnerAttentionTriage(sample);
    expect(summary).toMatchObject({ state: "AVAILABLE", open: 1, overdue: 1,
      critical: 1, missingActionEvidence: 0, ambiguous: 0 });
    expect(summary.review[0]).toMatchObject({ state: "OVERDUE", severity: "CRITICAL" });
  });
  it("never treats missing snapshot evidence as an empty successful queue", () => {
    for (const patch of [
      { workflowAvailable: false },
      { attentionItems: undefined }, { workflowExecutions: undefined },
      { workflowActionExecutions: undefined }, { branchScope: undefined },
      { loadedAt: "invalid" },
      { branchScope: { ...sample.branchScope, mode: "BRANCH" as const,
        selectedBranchId: "not-authorized" } },
    ]) {
      expect(summarizeOwnerAttentionTriage({ ...sample, ...patch }).state).toBe("UNVERIFIED");
    }
  });
  it("never leaks or counts other-branch, unmatched, preview or unrelated attention", () => {
    const foreign = { ...parent, id: "run-b", branchId: b };
    const foreignAttention = { ...attention, id: "attention-b", resourceId: foreign.id };
    const data: Input = { ...sample, workflowExecutions: [parent, foreign],
      attentionItems: [attention, foreignAttention, { ...attention, id: "unrelated",
        type: "OTHER" }] };
    expect(summarizeOwnerAttentionTriage(data).open).toBe(1);
    expect(summarizeOwnerAttentionTriage({ ...sample,
      workflowExecutions: [{ ...parent, mode: "PREVIEW" }] }).open).toBe(0);
    expect(summarizeOwnerAttentionTriage({ ...sample,
      workflowExecutions: [{ ...parent, matched: false }] }).open).toBe(0);
  });
  it("flags later failed retry and duplicate current attempt as missing current action evidence", () => {
    const failed = { ...action, id: "attempt-2", attemptNumber: 2, state: "FAILED" as const };
    for (const actions of [
      [action, failed],
      [action, { ...action, id: "duplicate" }],
      [{ ...action, branchId: b }],
      [{ ...action, attemptNumber: 0 }],
    ]) expect(summarizeOwnerAttentionTriage({
      ...sample, workflowActionExecutions: actions,
    }).missingActionEvidence).toBe(1);
  });
  it("quarantines duplicate IDs, unsupported statuses and closes resolved rows", () => {
    expect(summarizeOwnerAttentionTriage({
      ...sample, attentionItems: [attention, { ...attention }],
    })).toMatchObject({ open: 0, ambiguous: 1 });
    expect(summarizeOwnerAttentionTriage({
      ...sample, attentionItems: [{ ...attention, status: "UNKNOWN" }],
    })).toMatchObject({ open: 0, ambiguous: 1 });
    expect(summarizeOwnerAttentionTriage({
      ...sample, attentionItems: [{ ...attention, status: "RESOLVED" }],
    })).toMatchObject({ open: 0, closed: 1 });
  });
  it("renders an explicit unknown state, staff review link and no mutation controls", () => {
    const ui = readFileSync(join(process.cwd(),
      "src/features/operations/OwnerAutomationActivationChecklist.tsx"), "utf8");
    expect(ui).toContain("summarizeOwnerAttentionTriage(data)");
    expect(ui).toContain("Internal attention review priorities");
    expect(ui).toContain("not evidence of an empty or healthy attention queue");
    expect(ui).toContain("Inspect workflow activity");
    expect(ui).not.toContain("retryWorker(");
  });
});
