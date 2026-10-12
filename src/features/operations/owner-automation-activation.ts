import type { OperationalStaffSnapshot } from "./operational-product-runtime";

export type ActivationStatus = "READY" | "ACTION_REQUIRED" | "UNVERIFIED";
export type ActivationStepId = "service-catalog" | "pricing" | "quote-rule" | "execution-proof";

export interface ActivationStep {
  id: ActivationStepId;
  title: string;
  status: ActivationStatus;
  detail: string;
  module: "settings" | "automations";
}

export interface AutomationActivationSummary {
  readyCount: number;
  total: number;
  allEvidenceReady: boolean;
  steps: ActivationStep[];
}

/**
 * Owner-facing prerequisite readout derived only from authorized persisted
 * workspace snapshot fields. Never infer real provider delivery from switches,
 * published rules, fixtures, previews or missing RLS data.
 */
export function summarizeAutomationActivation(
  data: Pick<OperationalStaffSnapshot,
    "serviceCatalog" | "ownerPricingBookProof" | "branchScope" | "workflowAvailable" |
    "workflowRules" | "workflowRuleVersions" | "workflowExecutions" | "workflowActionExecutions">,
): AutomationActivationSummary {
  const catalogReady = data.serviceCatalog.some(item => item.active);
  const pricing = data.ownerPricingBookProof;
  // In a multi-branch business, a price book or rule from another branch
  // cannot certify the currently selected USD cleaning operation.
  const scopeKnown = Boolean(data.branchScope?.branches.length);
  const eligibleBranchIds = new Set((data.branchScope?.branches ?? [])
    .filter(branch => branch.currency === "USD" &&
      (data.branchScope?.mode !== "BRANCH" ||
        branch.id === data.branchScope.selectedBranchId))
    .map(branch => branch.id));
  const pricedBranchIds = new Set(pricing?.state === "VERIFIED"
    ? pricing.activeBranchIds.filter(id => eligibleBranchIds.has(id)) : []);
  const pricingVerified = pricedBranchIds.size > 0;
  const pricingScopeKnown = scopeKnown && eligibleBranchIds.size > 0;
  const versionsLoaded = data.workflowAvailable !== false &&
    Array.isArray(data.workflowRules) && Array.isArray(data.workflowRuleVersions);
  const activeRules = new Map(
    (data.workflowRules ?? [])
      .filter(rule => rule.status === "ACTIVE" && rule.publishedVersionNumber !== undefined)
      .map(rule => [rule.id, rule]),
  );
  const eligibleQuoteVersions = new Map(
    (data.workflowRuleVersions ?? [])
      .filter(version => {
        const rule = activeRules.get(version.ruleId);
        return pricedBranchIds.has(version.branchId) &&
          version.state === "PUBLISHED" && version.eventType === "QUOTE_ACCEPTED" &&
          version.actions.some(action => action.type === "CREATE_ATTENTION") &&
          rule?.branchId === version.branchId &&
          rule?.publishedVersionNumber === version.versionNumber;
      })
      .map(version => [version.id, version]),
  );
  const executionsLoaded = Array.isArray(data.workflowExecutions) &&
    Array.isArray(data.workflowActionExecutions) && versionsLoaded;
  const verifiedLiveExecutions = new Map(
    (data.workflowExecutions ?? [])
      .filter(execution => {
        const version = eligibleQuoteVersions.get(execution.ruleVersionId);
        return execution.mode === "LIVE" && execution.matched === true &&
          execution.state === "COMPLETED" && execution.eventType === "QUOTE_ACCEPTED" &&
          version?.ruleId === execution.ruleId && version?.branchId === execution.branchId;
      })
      .map(execution => [execution.id, execution.branchId]),
  );
  const internalExecutionSucceeded = (data.workflowActionExecutions ?? [])
    .some(action => action.actionType === "CREATE_ATTENTION" &&
      action.state === "SUCCEEDED" &&
      verifiedLiveExecutions.get(action.executionId) === action.branchId);

  const steps: ActivationStep[] = [
    {
      id: "service-catalog",
      title: "Offer at least one cleaning service",
      status: catalogReady ? "READY" : "ACTION_REQUIRED",
      detail: catalogReady
        ? "An active service is present in this workspace."
        : "Activate a reviewed service in workspace Settings.",
      module: "settings",
    },
    {
      id: "pricing",
      title: "Verify branch pricing",
      status: pricing === undefined || pricing.state === "UNAVAILABLE" || !pricingScopeKnown
        ? "UNVERIFIED" : pricingVerified ? "READY" : "ACTION_REQUIRED",
      detail: pricing === undefined || pricing.state === "UNAVAILABLE" || !pricingScopeKnown
        ? "Authorized USD branch or price-book evidence could not be verified; do not assume rates exist."
        : pricingVerified
          ? "An active price book is verified for an authorized USD branch in the current scope."
          : "Complete the price book for the selected authorized USD branch before quoting.",
      module: "settings",
    },
    {
      id: "quote-rule",
      title: "Publish an internal quote-accepted rule",
      status: !versionsLoaded || !pricingScopeKnown ||
        pricing?.state !== "VERIFIED" ? "UNVERIFIED"
        : eligibleQuoteVersions.size > 0 ? "READY" : "ACTION_REQUIRED",
      detail: !versionsLoaded || !pricingScopeKnown ||
        pricing?.state !== "VERIFIED"
        ? "Branch-scoped published rule or price-book evidence is unavailable."
        : eligibleQuoteVersions.size
          ? "A published quote rule creates internal attention in a priced, authorized USD branch."
          : "Publish a QUOTE_ACCEPTED rule with CREATE_ATTENTION in a branch with verified pricing.",
      module: "automations",
    },
    {
      id: "execution-proof",
      title: "Verify a saved internal execution",
      status: !executionsLoaded || !pricingScopeKnown ||
        pricing?.state !== "VERIFIED" ? "UNVERIFIED"
        : internalExecutionSucceeded ? "READY" : "ACTION_REQUIRED",
      detail: !executionsLoaded || !pricingScopeKnown ||
        pricing?.state !== "VERIFIED"
        ? "Authorized branch, pricing or execution history is unavailable; do not claim a live result."
        : internalExecutionSucceeded
          ? "A LIVE quote rule and succeeded internal attention receipt match this authorized priced branch."
          : "Verify a succeeded LIVE internal action in the same authorized, priced branch.",
      module: "automations",
    },
  ];
  const readyCount = steps.filter(step => step.status === "READY").length;
  return {
    readyCount, total: steps.length,
    allEvidenceReady: readyCount === steps.length,
    steps,
  };
}
