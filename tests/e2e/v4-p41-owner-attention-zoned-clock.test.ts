import { describe, expect, it } from "vitest";
import { summarizeOwnerAttentionTriage } from "@/features/operations/owner-attention-triage";
type Input = Parameters<typeof summarizeOwnerAttentionTriage>[0];
const now = "2026-10-29T11:00:00Z";
const run = { id: "run-saved", branchId: "branch-a", ruleId: "rule-a",
  ruleVersionId: "version-a", mode: "LIVE", eventType: "QUOTE_ACCEPTED",
  matched: true, recursionDepth: 0, state: "COMPLETED", createdAt: now } as const;
const action = { id: "saved-action", executionId: run.id, branchId: run.branchId,
  actionIndex: 0, attemptNumber: 1, actionType: "CREATE_ATTENTION",
  state: "SUCCEEDED", createdAt: now } as const;
const attention = { id: "saved-attention", type: "WORKFLOW_RULE", status: "OPEN",
  resourceType: "workflow_execution", resourceId: run.id, severity: "CRITICAL",
  summary: "Review saved action", dueAt: "2026-10-29T09:00:00Z" } as const;
const input: Input = {
  loadedAt: now, workflowAvailable: true,
  branchScope: { mode: "BRANCH", selectedBranchId: run.branchId,
    branches: [{ id: run.branchId, code: "A", name: "Only authorized",
      timezone: "UTC", currency: "USD", isDefault: true }] },
  workflowExecutions: [run], workflowActionExecutions: [action],
  attentionItems: [attention],
};

describe("P41 strict branch-scoped attention clock and deadline integrity", () => {
  it("preserves genuine zoned overdue and missing-due manual review", () => {
    expect(summarizeOwnerAttentionTriage(input)).toMatchObject({
      state: "AVAILABLE", open: 1, overdue: 1, ambiguous: 0,
    });
    expect(summarizeOwnerAttentionTriage({
      ...input, attentionItems: [{ ...attention, dueAt: undefined }],
    })).toMatchObject({ state: "AVAILABLE", open: 1, overdue: 0, ambiguous: 0 });
  });
  it("does not misclassify unzoned or invalid civil/offset due dates as healthy open items", () => {
    for (const dueAt of [
      "2026-10-29T10:00:00", "2026-02-30T10:00:00Z",
      "2026-10-29T10:00:00+15:00", "2026-10-29", "", "N/A",
    ]) {
      const outcome = summarizeOwnerAttentionTriage({
        ...input, attentionItems: [{ ...attention, dueAt }],
      });
      expect(outcome).toMatchObject({
        state: "AVAILABLE", open: 0, overdue: 0, critical: 0, ambiguous: 1,
      });
      expect(outcome.review).toEqual([]);
    }
  });
  it("rejects snapshot clocks without authoritative timezone instead of trusting local Date.parse", () => {
    for (const loadedAt of [
      "2026-10-29T11:00:00", "2026-02-30T11:00:00Z",
      "2026-10-29T11:00:00+15:00", "invalid", "",
    ]) expect(summarizeOwnerAttentionTriage({ ...input, loadedAt }))
      .toMatchObject({ state: "UNVERIFIED", review: [], open: 0 });
  });
  it("respects explicit offsets and does not quarantine valid future deadlines", () => {
    expect(summarizeOwnerAttentionTriage({ ...input,
      attentionItems: [{ ...attention, dueAt: "2026-10-29T17:00:00+06:00" }],
    })).toMatchObject({ state: "AVAILABLE", open: 1, overdue: 0, ambiguous: 0 });
    expect(summarizeOwnerAttentionTriage({ ...input,
      attentionItems: [{ ...attention, dueAt: "2026-10-29T15:00:00+06:00" }],
    })).toMatchObject({ state: "AVAILABLE", open: 1, overdue: 1, ambiguous: 0 });
  });
  it("keeps unrelated foreign branch and closed records outside actionable clock alerts", () => {
    expect(summarizeOwnerAttentionTriage({ ...input,
      attentionItems: [
        { ...attention, id: "foreign", resourceId: "foreign-run", dueAt: "junk" },
        { ...attention, id: "done", status: "RESOLVED", dueAt: "junk" },
      ],
    })).toMatchObject({ state: "AVAILABLE", ambiguous: 0, open: 0, closed: 1 });
  });
});
