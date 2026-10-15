import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { summarizeAutomationActivation } from "@/features/operations/owner-automation-activation";

type Input = Parameters<typeof summarizeAutomationActivation>[0];

const empty: Input = {
  branchScope: { mode: "BRANCH", selectedBranchId: "branch-1", branches: [{
    id: "branch-1", code: "US-N", name: "North", currency: "USD", timezone: "America/New_York", isDefault: true,
  }] },
  serviceCatalog: [],
  requests: [],
  quotes: [],
  workflowAvailable: true,
  workflowRules: [],
  workflowRuleVersions: [],
  workflowExecutions: [],
  workflowActionExecutions: [],
  attentionItems: [],
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
  sourceQuoteId: "quote-accepted",
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

const persistedAttention: NonNullable<Input["attentionItems"]>[number] = {
  id: "attention-1", type: "WORKFLOW_RULE", status: "OPEN",
  severity: "INFO", resourceType: "workflow_execution",
  resourceId: live.id, summary: "Owner must review the accepted quote",
};
const acceptedRequest: NonNullable<Input["requests"]>[number] = {
  id: "request-accepted", branchId: "branch-1",
  status: "READY", serviceLabel: "Standard cleaning", version: 2,
};
const acceptedQuote: NonNullable<Input["quotes"]>[number] = {
  id: "quote-accepted", requestId: acceptedRequest.id, version: 2,
  status: "ACCEPTED", currency: "USD", totalMinor: 20000,
  subtotalMinor: 20000, taxMinor: 0,
  depositMinor: 5000, balanceMinor: 15000, durationMinutes: 120,
  lineItems: [{ code: "BASE", description: "Base service", amountMinor: 20000, durationMinutes: 120 }],
  bufferMinutes: 15,
};

const priced: Input = {
  ...empty,
  ownerPricingBookProof: { state: "VERIFIED", activeBranchIds: ["branch-1"] },
};

describe("owner automation activation evidence", () => {
  it("credits source-key-verified quote identity and linked internal attention, not branch coincidence", () => {
    const summary = summarizeAutomationActivation({
      ...priced,
      serviceCatalog: [{ active: true } as Input["serviceCatalog"][number]],
      requests: [acceptedRequest], quotes: [acceptedQuote],
      workflowRules: [activeRule], workflowRuleVersions: [published],
      workflowExecutions: [live], workflowActionExecutions: [completedAttention],
      attentionItems: [persistedAttention],
    });
    expect(summary.allEvidenceReady).toBe(true);
    expect(summary.steps[4].detail).toContain("exact accepted quote");
    expect(summary.steps[4].detail).toContain("remain unverified");
    const ui = readFileSync(join(process.cwd(),
      "src/features/operations/OwnerAutomationActivationChecklist.tsx"), "utf8");
    expect(ui).toContain("Source-linked evidence");
    expect(ui).toContain("Exact saved quote-source and linked internal attention");
  });

  it("rejects same-branch but different-quote executions and missing saved attention items", () => {
    const base: Input = {
      ...priced, serviceCatalog: [{ active: true } as Input["serviceCatalog"][number]],
      workflowRules: [activeRule], workflowRuleVersions: [published],
      requests: [acceptedRequest], quotes: [acceptedQuote],
      workflowExecutions: [live], workflowActionExecutions: [completedAttention],
      attentionItems: [persistedAttention],
    };
    expect(summarizeAutomationActivation(base).steps[4].status).toBe("READY");
    for (const workflowExecutions of [
      [{ ...live, sourceQuoteId: undefined }],
      [{ ...live, sourceQuoteId: "other-accepted-quote" }],
      [{ ...live, mode: "PREVIEW" as const }],
    ]) {
      expect(summarizeAutomationActivation({ ...base, workflowExecutions }).steps[4].status)
        .toBe("ACTION_REQUIRED");
    }
    for (const attentionItems of [
      [],
      [{ ...persistedAttention, resourceId: "another-execution" }],
      [{ ...persistedAttention, resourceType: "request" }],
      [{ ...persistedAttention, type: "OTHER" }],
    ]) expect(summarizeAutomationActivation({ ...base, attentionItems }).steps[4].status)
      .toBe("ACTION_REQUIRED");
    expect(summarizeAutomationActivation({ ...base, attentionItems: undefined }).steps[4].status)
      .toBe("UNVERIFIED");
  });

  it("never calls empty workspace or unavailable pricing an operational success", () => {
    const summary = summarizeAutomationActivation(empty);
    expect(summary.readyCount).toBe(0);
    expect(summary.total).toBe(5);
    expect(summary.allEvidenceReady).toBe(false);
    expect(summary.steps.map(s => s.status))
      .toEqual(["ACTION_REQUIRED", "UNVERIFIED", "UNVERIFIED", "UNVERIFIED", "UNVERIFIED"]);
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
      ...priced, workflowRules: [activeRule], workflowRuleVersions: versions,
    });
    expect(summary.steps[2].status).toBe("ACTION_REQUIRED");
  });

  it("does not credit archived rules or old published versions", () => {
    expect(summarizeAutomationActivation({
      ...priced, workflowRules: [{ ...activeRule, status: "ARCHIVED" }],
      workflowRuleVersions: [published],
    }).steps[2].status).toBe("ACTION_REQUIRED");
    expect(summarizeAutomationActivation({
      ...priced, workflowRules: [{ ...activeRule, publishedVersionNumber: 3 }],
      workflowRuleVersions: [published],
    }).steps[2].status).toBe("ACTION_REQUIRED");
  });

  it("does not overclaim accepted-quote workflow readiness from a corrupted price snapshot", () => {
    const baseline: Input = {
      ...priced, requests: [acceptedRequest], quotes: [acceptedQuote],
      workflowRules: [activeRule], workflowRuleVersions: [published],
      workflowExecutions: [live], workflowActionExecutions: [completedAttention],
    };
    expect(summarizeAutomationActivation(baseline).steps[3].status).toBe("READY");
    for (const patch of [
      { subtotalMinor: 19000 }, { taxMinor: -1 }, { lineItems: [] },
      { depositMinor: 5100 }, { durationMinutes: 80 }, { lineItems: undefined },
    ]) {
      const invalid = summarizeAutomationActivation({
        ...baseline, quotes: [{ ...acceptedQuote, ...patch }],
      });
      expect(invalid.steps[3].status).not.toBe("READY");
      expect(invalid.allEvidenceReady).toBe(false);
    }
  });

  it("does not credit previews, other rule executions or unsucceeded actions", () => {
    const summary = summarizeAutomationActivation({
      ...priced,
      workflowRules: [activeRule],
      workflowRuleVersions: [published],
      workflowExecutions: [{ ...live, mode: "PREVIEW" }, { ...live, id: "execution-2", ruleVersionId: "other" }],
      workflowActionExecutions: [completedAttention],
    });
    expect(summary.steps[2].status).toBe("READY");
    expect(summary.steps[4].status).toBe("ACTION_REQUIRED");
    expect(summarizeAutomationActivation({
      ...priced, workflowRules: [activeRule], workflowRuleVersions: [published],
      workflowExecutions: [live],
      workflowActionExecutions: [{ ...completedAttention, state: "APPROVAL_REQUIRED" }],
    }).steps[4].status).toBe("ACTION_REQUIRED");
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
      attentionItems: [persistedAttention],
      requests: [acceptedRequest], quotes: [acceptedQuote],
    });
    expect(summary.readyCount).toBe(5);
    expect(summary.allEvidenceReady).toBe(true);
  });

  it("credits saved internal attention when external email approval remains pending", () => {
    const data: Input = {
      ...empty,
      serviceCatalog: [{ active: true } as Input["serviceCatalog"][number]],
      ownerPricingBookProof: { state: "VERIFIED", activeBranchIds: ["branch-1"] },
      workflowRules: [activeRule], workflowRuleVersions: [published],
      workflowExecutions: [{ ...live, state: "ACTIONS_PENDING" }],
      attentionItems: [persistedAttention],
      workflowActionExecutions: [
        completedAttention,
        { ...completedAttention, id: "outbound", actionIndex: 1,
          actionType: "SEND_EMAIL_TEMPLATE", state: "APPROVAL_REQUIRED" },
      ],
      requests: [acceptedRequest], quotes: [acceptedQuote],
    };
    const summary = summarizeAutomationActivation(data);
    expect(summary.steps[4].status).toBe("READY");
    expect(summary.allEvidenceReady).toBe(true);
    for (const state of ["PENDING", "APPROVAL_REQUIRED", "FAILED", "SUPPRESSED"] as const) {
      const denied = summarizeAutomationActivation({
        ...data,
        workflowActionExecutions: [{ ...completedAttention, state }],
      });
      expect(denied.steps[4].status).toBe("ACTION_REQUIRED");
      expect(denied.allEvidenceReady).toBe(false);
    }
    expect(summarizeAutomationActivation({
      ...data, workflowExecutions: [{ ...live, state: "PARTIAL_FAILED" }],
    }).steps[4].status).toBe("ACTION_REQUIRED");
    expect(summarizeAutomationActivation({
      ...data, workflowExecutions: [{ ...live, mode: "PREVIEW" }],
    }).steps[4].status).toBe("ACTION_REQUIRED");
  });

  it("requires every planned internal attention action, not one action from a partially executed rule", () => {
    const internalSecond = { ...completedAttention, id: "action-second",
      actionIndex: 2, state: "PENDING" as const };
    const data: Input = {
      ...empty,
      serviceCatalog: [{ active: true } as Input["serviceCatalog"][number]],
      ownerPricingBookProof: { state: "VERIFIED", activeBranchIds: ["branch-1"] },
      workflowRules: [activeRule],
      workflowRuleVersions: [{ ...published, maxActionsPerEvent: 3, actions: [
        { type: "CREATE_ATTENTION" },
        { type: "SEND_EMAIL_TEMPLATE" },
        { type: "CREATE_ATTENTION" },
      ] }],
      workflowExecutions: [{ ...live, state: "ACTIONS_PENDING" }],
      attentionItems: [persistedAttention, { ...persistedAttention, id: "attention-2" }],
      workflowActionExecutions: [completedAttention, internalSecond],
      requests: [acceptedRequest], quotes: [acceptedQuote],
    };
    expect(summarizeAutomationActivation(data).steps[4].status).toBe("ACTION_REQUIRED");
    const completed = summarizeAutomationActivation({
      ...data,
      workflowActionExecutions: [completedAttention, { ...internalSecond, state: "SUCCEEDED" }],
    });
    expect(completed.steps[4].status).toBe("READY");
    expect(completed.allEvidenceReady).toBe(true);
    expect(summarizeAutomationActivation({
      ...data,
      workflowActionExecutions: [completedAttention,
        { ...internalSecond, state: "SUCCEEDED", actionIndex: 3 }],
    }).steps[4].status).toBe("ACTION_REQUIRED");
  });

  it("requires an accepted saved quote, not merely a published rule and internal action", () => {
    const data: Input = {
      ...empty, requests: [], quotes: [],
      serviceCatalog: [{ active: true } as Input["serviceCatalog"][number]],
      ownerPricingBookProof: { state: "VERIFIED", activeBranchIds: ["branch-1"] },
      workflowRules: [activeRule], workflowRuleVersions: [published],
      workflowExecutions: [live], workflowActionExecutions: [completedAttention],
    };
    const summary = summarizeAutomationActivation(data);
    expect(summary.steps[3]).toMatchObject({
      id: "accepted-quote", status: "ACTION_REQUIRED", module: "requests",
    });
    expect(summary.steps[4].status).toBe("ACTION_REQUIRED");
    expect(summary.readyCount).toBe(3);
    expect(summary.allEvidenceReady).toBe(false);
    expect(summarizeAutomationActivation({
      ...data, requests: [acceptedRequest], quotes: [{ ...acceptedQuote, status: "SENT" }],
    }).steps[3].status).toBe("ACTION_REQUIRED");
  });

  it("rejects accepted quotes without matching authorized branch, saved request or correct USD currency", () => {
    const data: Input = {
      ...priced, requests: [acceptedRequest], quotes: [acceptedQuote],
    };
    expect(summarizeAutomationActivation(data).steps[3].status).toBe("READY");
    for (const quotes of [
      [{ ...acceptedQuote, currency: "GBP" }],
      [{ ...acceptedQuote, totalMinor: -10 }],
      [{ ...acceptedQuote, requestId: "missing-request" }],
    ]) {
      expect(summarizeAutomationActivation({ ...data, quotes }).steps[3].status)
        .toBe("ACTION_REQUIRED");
    }
    expect(summarizeAutomationActivation({
      ...data, requests: [{ ...acceptedRequest, branchId: "foreign-branch" }],
    }).steps[3].status).toBe("ACTION_REQUIRED");
  });

  it("does not borrow accepted quotes from another owner's selected or unpriced branch", () => {
    const data: Input = {
      ...priced,
      requests: [{ ...acceptedRequest, branchId: "branch-2" }],
      quotes: [acceptedQuote],
    };
    expect(summarizeAutomationActivation(data).steps[3].status).toBe("ACTION_REQUIRED");
    const twoBranches: Input = {
      ...data,
      branchScope: {mode: "ALL", branches: [
        ...empty.branchScope!.branches,
        {id:"branch-2",code:"US-S",name:"South",currency:"USD",
          timezone:"America/Chicago",isDefault:false},
      ]},
      ownerPricingBookProof: {state:"VERIFIED",activeBranchIds:["branch-1"]},
    };
    expect(summarizeAutomationActivation(twoBranches).steps[3].status).toBe("ACTION_REQUIRED");
    expect(summarizeAutomationActivation({
      ...twoBranches, ownerPricingBookProof: {state:"VERIFIED",activeBranchIds:["branch-2"]},
    }).steps[3].status).toBe("READY");
  });

  it("does not infer real customer acceptance when quote data could not be read", () => {
    const data: Input = {
      ...priced, requests: undefined, quotes: undefined,
    };
    expect(summarizeAutomationActivation(data).steps[3].status).toBe("UNVERIFIED");
    expect(summarizeAutomationActivation({
      ...data, requests: [acceptedRequest], quotes: undefined,
    }).steps[3].status).toBe("UNVERIFIED");
  });

  it("cannot combine accepted quotes in Branch B with an internal action in Branch A", () => {
    const south = { id: "branch-2", code: "US-S", name: "South",
      currency: "USD", timezone: "America/Chicago", isDefault: false };
    const base: Input = {
      ...empty,
      branchScope: { mode: "ALL", branches: [...empty.branchScope!.branches, south] },
      serviceCatalog: [{ active: true } as Input["serviceCatalog"][number]],
      ownerPricingBookProof: { state: "VERIFIED", activeBranchIds: ["branch-1", "branch-2"] },
      workflowRules: [activeRule], workflowRuleVersions: [published],
      workflowExecutions: [live], workflowActionExecutions: [completedAttention],
      requests: [{ ...acceptedRequest, branchId: "branch-2" }],
      quotes: [acceptedQuote], attentionItems: [persistedAttention],
    };
    const crossBranch = summarizeAutomationActivation(base);
    expect(crossBranch.steps[1].status).toBe("READY");
    expect(crossBranch.steps[2].status).toBe("READY");
    expect(crossBranch.steps[3].status).toBe("READY");
    expect(crossBranch.steps[4].status).toBe("ACTION_REQUIRED");
    expect(crossBranch.allEvidenceReady).toBe(false);

    const coherent = summarizeAutomationActivation({
      ...base, requests: [acceptedRequest],
    });
    expect(coherent.steps[4].status).toBe("READY");
    expect(coherent.readyCount).toBe(5);
    expect(coherent.allEvidenceReady).toBe(true);
  });

  it("fails closed when selected branch is not the priced branch, even when some branch is ready", () => {
    const readyElsewhere: Input = {
      ...empty,
      serviceCatalog: [{ active: true } as Input["serviceCatalog"][number]],
      ownerPricingBookProof: { state: "VERIFIED", activeBranchIds: ["branch-2"] },
      workflowRules: [activeRule], workflowRuleVersions: [published],
      workflowExecutions: [live], workflowActionExecutions: [completedAttention],
    };
    const result = summarizeAutomationActivation(readyElsewhere);
    expect(result.steps[1].status).toBe("ACTION_REQUIRED");
    expect(result.steps[2].status).toBe("ACTION_REQUIRED");
    expect(result.steps[4].status).toBe("ACTION_REQUIRED");
    expect(result.allEvidenceReady).toBe(false);
  });

  it("does not mix pricing in branch A with published rules or successful attention in branch B", () => {
    const branchTwo = { id: "branch-2", code: "US-S", name: "South",
      currency: "USD", timezone: "America/Chicago", isDefault: false };
    const mixed: Input = {
      ...empty,
      branchScope: { mode: "ALL", branches: [...empty.branchScope!.branches, branchTwo] },
      serviceCatalog: [{ active: true } as Input["serviceCatalog"][number]],
      ownerPricingBookProof: { state: "VERIFIED", activeBranchIds: ["branch-2"] },
      workflowRules: [activeRule], workflowRuleVersions: [published],
      workflowExecutions: [live], workflowActionExecutions: [completedAttention],
    };
    const result = summarizeAutomationActivation(mixed);
    expect(result.steps[1].status).toBe("READY");
    expect(result.steps[2].status).toBe("ACTION_REQUIRED");
    expect(result.steps[4].status).toBe("ACTION_REQUIRED");
    expect(result.allEvidenceReady).toBe(false);
  });

  it("does not credit an attention action from a foreign branch even if execution ID matches", () => {
    const result = summarizeAutomationActivation({
      ...empty, serviceCatalog: [{ active: true } as Input["serviceCatalog"][number]],
      ownerPricingBookProof: { state: "VERIFIED", activeBranchIds: ["branch-1"] },
      workflowRules: [activeRule], workflowRuleVersions: [published],
      workflowExecutions: [live],
      workflowActionExecutions: [{ ...completedAttention, branchId: "branch-2" }],
    });
    expect(result.steps[2].status).toBe("READY");
    expect(result.steps[4].status).toBe("ACTION_REQUIRED");
  });

  it("does not credit another currency or unavailable branch scope as real USD readiness", () => {
    const data: Input = {
      ...empty, serviceCatalog: [{ active: true } as Input["serviceCatalog"][number]],
      ownerPricingBookProof: { state: "VERIFIED", activeBranchIds: ["branch-1"] },
      workflowRules: [activeRule], workflowRuleVersions: [published],
      workflowExecutions: [live], workflowActionExecutions: [completedAttention],
    };
    const withoutScope = summarizeAutomationActivation({ ...data, branchScope: undefined });
    expect(withoutScope.steps.slice(1).map(s => s.status))
      .toEqual(["UNVERIFIED", "UNVERIFIED", "UNVERIFIED", "UNVERIFIED"]);
    const wrongCurrency = summarizeAutomationActivation({ ...data,
      branchScope: { ...empty.branchScope!, branches: [
        { ...empty.branchScope!.branches[0], currency: "GBP" },
      ] },
    });
    expect(wrongCurrency.steps.slice(1).every(step => step.status === "UNVERIFIED")).toBe(true);
  });

  it("treats missing workflow snapshots as unverified, not a proven zero", () => {
    const summary = summarizeAutomationActivation({
      ...empty, workflowAvailable: false,
      workflowRules: undefined, workflowRuleVersions: undefined, workflowExecutions: undefined,
      workflowActionExecutions: undefined,
    });
    expect(summary.steps[2].status).toBe("UNVERIFIED");
    expect(summary.steps[4].status).toBe("UNVERIFIED");
  });
});
