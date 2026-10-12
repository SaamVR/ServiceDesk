import { describe, expect, it } from "vitest";
import type { OperationalStaffSnapshot } from "@/features/operations/operational-product-runtime";
import { summarizeAutomationActivation } from "@/features/operations/owner-automation-activation";

type Input = Pick<OperationalStaffSnapshot,
  "serviceCatalog" | "ownerPricingBookProof" | "workflowAvailable" |
  "workflowRules" | "workflowRuleVersions" | "workflowExecutions" | "workflowActionExecutions">;

const empty: Input = {
  serviceCatalog: [],
  workflowAvailable: true,
  workflowRules: [],
  workflowRuleVersions: [],
  workflowExecutions: [],
  workflowActionExecutions: [],
};

const activeRule: NonNullable<Input["workflowRules"]>[number] = {
  id: "rule-1", branchId: "branch-1", code: "INTERNAL_QUOTE_REVIEW",
  name: "Internal quote review", status: "ACTIVE",
  publishedVersionNumber: 2, version: 2, updatedAt: "2026-10-12T12:00:00Z",
};

const published: NonNullable<Input["workflowRuleVersions"]>[number] = {
  id: "rule-v1", ruleId: "rule-1", versionNumber: 2, branchId: "branch-1",
  state: "PUBLISHED", eventType: "QUOTE_ACCEPTED", conditions: [],
  actions: [{ type: "CREATE_ATTENTION" }], maxActionsPerEvent: 1,
  createdAt: "2026-10-12T12:00:00Z",
};

const live: NonNullable<Input["workflowExecutions"]>[number] = {
  id: "execution-1", mode: "LIVE", ruleVersionId: "rule-v1",
  ruleId: "rule-1", branchId: "branch-1", matched: true,
  eventType: "QUOTE_ACCEPTED", state: "COMPLETED", recursionDepth: 0,
  createdAt: "2026-10-12T12:00:00Z",
};

const completedAttention: NonNullable<Input["workflowActionExecutions"]>[number] = {
  id: "action-1", executionId: "execution-1", branchId: "branch-1",
  actionIndex: 0, attemptNumber: 1,
  actionType: "CREATE_ATTENTION", state: "SUCCEEDED",
  createdAt: "2026-10-12T12:00:00Z",
};

describe("owner automation activation evidence", () => {
  it("never calls empty workspace or unavailable pricing an operational success", () => {
    const summary = summarizeAutomationActivation(empty);
    expect(summary.readyCount).toBe(0);
    expect(summary.total).toBe(4);
    expect(summary.allEvidenceReady).toBe(false);
    expect(summary.steps.map(s => s.status))
      .toEqual(["ACTION_REQUIRED", "UNVERIFIED", "ACTION_REQUIRED", "ACTION_REQUIRED"]);
  });

  it("requires active catalog and verified price-book evidence independently", () => {
    const input: Input = {
      ...empty,
      serviceCatalog: [{ active: true } as Input["serviceCatalog"][number]],
      ownerPricingBookProof: { state: "VERIFIED", activeBranchIds: ["branch-1"] },
    };
    const summary = summarizeAutomationActivation(input);
    expect(summary.readyCount).toBe(2);
    expect(summary.steps.slice(0,2).map(s => s.status)).toEqual(["READY", "READY"]);
    expect(summarizeAutomationActivation({
      ...input, ownerPricingBookProof: { state: "VERIFIED", activeBranchIds: [] },
    }).steps[1].status).toBe("ACTION_REQUIRED");
  });

  it("does not credit DRAFT, unrelated events or external-only published rules", () => {
    const versions: Input["workflowRuleVersions"] = [
      { ...published, state: "DRAFT" },
      { ...published, id: "v2", eventType: "REQUEST_CREATED" },
      { ...published, id: "v3", actions: [{ type: "SEND_EMAIL_TEMPLATE" }] },
    ];
    const summary = summarizeAutomationActivation({
      ...empty, workflowRules: [activeRule], workflowRuleVersions: versions,
    });
    expect(summary.steps[2].status).toBe("ACTION_REQUIRED");
  });

  it("does not credit archived rules or old published versions", () => {
    expect(summarizeAutomationActivation({
      ...empty, workflowRules: [{ ...activeRule, status: "ARCHIVED" }],
      workflowRuleVersions: [published],
    }).steps[2].status).toBe("ACTION_REQUIRED");
    expect(summarizeAutomationActivation({
      ...empty, workflowRules: [{ ...activeRule, publishedVersionNumber: 3 }],
      workflowRuleVersions: [published],
    }).steps[2].status).toBe("ACTION_REQUIRED");
  });

  it("does not credit previews, other rule executions or unsucceeded actions", () => {
    const summary = summarizeAutomationActivation({
      ...empty,
      workflowRules: [activeRule],
      workflowRuleVersions: [published],
      workflowExecutions: [{ ...live, mode: "PREVIEW" }, { ...live, id: "execution-2", ruleVersionId: "other" }],
      workflowActionExecutions: [completedAttention],
    });
    expect(summary.steps[2].status).toBe("READY");
    expect(summary.steps[3].status).toBe("ACTION_REQUIRED");
    expect(summarizeAutomationActivation({
      ...empty, workflowRules: [activeRule], workflowRuleVersions: [published],
      workflowExecutions: [live],
      workflowActionExecutions: [{ ...completedAttention, state: "APPROVAL_REQUIRED" }],
    }).steps[3].status).toBe("ACTION_REQUIRED");
  });

  it("credits only matching persisted LIVE internal attention success", () => {
    const summary = summarizeAutomationActivation({
      ...empty,
      serviceCatalog: [{ active: true } as Input["serviceCatalog"][number]],
      ownerPricingBookProof: { state: "VERIFIED", activeBranchIds: ["branch-1"] },
      workflowRules: [activeRule],
      workflowRuleVersions: [published],
      workflowExecutions: [live],
      workflowActionExecutions: [completedAttention],
    });
    expect(summary.readyCount).toBe(4);
    expect(summary.allEvidenceReady).toBe(true);
  });

  it("treats missing workflow snapshots as unverified, not a proven zero", () => {
    const summary = summarizeAutomationActivation({
      ...empty, workflowAvailable: false,
      workflowRules: undefined, workflowRuleVersions: undefined, workflowExecutions: undefined,
      workflowActionExecutions: undefined,
    });
    expect(summary.steps[2].status).toBe("UNVERIFIED");
    expect(summary.steps[3].status).toBe("UNVERIFIED");
  });
});
