import { describe, expect, it } from "vitest";
import { summarizeAutomationActivation } from "@/features/operations/owner-automation-activation";

type Input = Parameters<typeof summarizeAutomationActivation>[0];
const branchId = "branch-authorized";
const request = { id: "request-1", branchId, status: "READY", serviceLabel: "Standard cleaning", version: 1 };
const quote = {
  id: "quote-1", requestId: request.id, version: 1, status: "ACCEPTED", currency: "USD",
  subtotalMinor: 10000, taxMinor: 0, totalMinor: 10000, depositMinor: 2000,
  balanceMinor: 8000, durationMinutes: 120, bufferMinutes: 0,
  lineItems: [{ code: "BASE", description: "Base cleaning", amountMinor: 10000, durationMinutes: 120 }],
};
const parent = {
  id: "execution-1", mode: "LIVE", ruleVersionId: "v1", sourceQuoteId: quote.id,
  ruleId: "rule-1", branchId, matched: true, eventType: "QUOTE_ACCEPTED",
  state: "COMPLETED", recursionDepth: 0, createdAt: "2026-10-29T01:00:00Z",
} as const;
const first = {
  id: "attempt-1", executionId: parent.id, branchId, actionIndex: 0, attemptNumber: 1,
  actionType: "CREATE_ATTENTION", state: "SUCCEEDED", createdAt: "2026-10-29T01:00:01Z",
} as const;
const saved: Input = {
  serviceCatalog: [{ code: "STANDARD", active: true } as Input["serviceCatalog"][number]],
  branchScope: { mode: "BRANCH", selectedBranchId: branchId,
    branches: [{ id: branchId, code: "US", name: "Authorized", currency: "USD",
      timezone: "UTC", isDefault: true }] },
  ownerPricingBookProof: { state: "VERIFIED", activeBranchIds: [branchId], existingBookBranchIds: [branchId] },
  workflowAvailable: true,
  workflowRules: [{ id: "rule-1", branchId, status: "ACTIVE", publishedVersionNumber: 1,
    name: "Owner attention", code: "QUOTE_ALERT", version: 1, updatedAt: "2026-10-29T01:00:00Z" }],
  workflowRuleVersions: [{ id: "v1", ruleId: "rule-1", branchId, versionNumber: 1, state: "PUBLISHED",
    eventType: "QUOTE_ACCEPTED", conditions: [], actions: [{ type: "CREATE_ATTENTION" }],
    maxActionsPerEvent: 1, createdAt: "2026-10-29T01:00:00Z" }],
  requests: [request as NonNullable<Input["requests"]>[number]],
  quotes: [quote as NonNullable<Input["quotes"]>[number]],
  workflowExecutions: [parent],
  workflowActionExecutions: [first],
  attentionItems: [{ id: "attention-1", type: "WORKFLOW_RULE", status: "OPEN",
    severity: "WARNING", resourceType: "workflow_execution",
    resourceId: parent.id, summary: "Review accepted quote" }],
};
function status(actions: NonNullable<Input["workflowActionExecutions"]>) {
  return summarizeAutomationActivation({ ...saved, workflowActionExecutions: actions }).steps[4].status;
}

describe("P33 owner automation activation - current replay attempts", () => {
  it("credits a single unambiguous latest persisted success", () => {
    expect(status([first])).toBe("READY");
    expect(status([{ ...first, id: "attempt-2", attemptNumber: 2 }])).toBe("READY");
    expect(status([first, { ...first, id: "attempt-2", attemptNumber: 2 }])).toBe("READY");
  });
  it("rejects historical success overridden by newer FAILED, PENDING or APPROVAL_REQUIRED", () => {
    for (const state of ["FAILED", "PENDING", "APPROVAL_REQUIRED", "SUPPRESSED"] as const) {
      expect(status([first, { ...first, id: "attempt-2", attemptNumber: 2, state }]))
        .toBe("ACTION_REQUIRED");
    }
  });
  it("refuses conflicting newest attempts even if each says SUCCEEDED", () => {
    expect(status([first, { ...first, id: "attempt-duplicate" }])).toBe("ACTION_REQUIRED");
    expect(status([first, { ...first, id: "attempt-2", attemptNumber: 2 },
      { ...first, id: "attempt-3", attemptNumber: 2 }])).toBe("ACTION_REQUIRED");
  });
  it("refuses branch mismatches, invalid attempt numbers and unsupported saved actions", () => {
    for (const patch of [
      { branchId: "foreign-branch" }, { attemptNumber: 0 },
      { actionIndex: -1 }, { actionType: "SEND_EMAIL_TEMPLATE" as const },
    ]) {
      expect(status([first, { ...first, id: "other", attemptNumber: 2, ...patch }]))
        .toBe("ACTION_REQUIRED");
    }
  });
  it("does not make saved LIVE evidence out of PREVIEW, a foreign quote or missing attention", () => {
    expect(summarizeAutomationActivation({ ...saved,
      workflowExecutions: [{ ...parent, mode: "PREVIEW" }] }).steps[4].status).not.toBe("READY");
    expect(summarizeAutomationActivation({ ...saved,
      workflowExecutions: [{ ...parent, sourceQuoteId: "other-quote" }] }).steps[4].status).not.toBe("READY");
    expect(summarizeAutomationActivation({ ...saved,
      attentionItems: [] }).steps[4].status).not.toBe("READY");
  });
});
