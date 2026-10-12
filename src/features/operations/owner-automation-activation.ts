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
    "serviceCatalog" | "ownerPricingBookProof" | "workflowAvailable" |
    "workflowRules" | "workflowRuleVersions" | "workflowExecutions" | "workflowActionExecutions">,
): AutomationActivationSummary {
  const catalogReady = data.serviceCatalog.some(item => item.active);
  const pricing = data.ownerPricingBookProof;
  const pricingVerified = pricing?.state === "VERIFIED" && pricing.activeBranchIds.length > 0;
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
        return version.state === "PUBLISHED" && version.eventType === "QUOTE_ACCEPTED" &&
          version.actions.some(action => action.type === "CREATE_ATTENTION") &&
          rule?.branchId === version.branchId &&
          rule?.publishedVersionNumber === version.versionNumber;
      })
      .map(version => [version.id, version]),
  );
  const executionsLoaded = Array.isArray(data.workflowExecutions) &&
    Array.isArray(data.workflowActionExecutions) && versionsLoaded;
  const verifiedLiveExecutions = new Set(
    (data.workflowExecutions ?? [])
      .filter(execution => {
        const version = eligibleQuoteVersions.get(execution.ruleVersionId);
        return execution.mode === "LIVE" && execution.matched === true &&
          execution.state === "COMPLETED" && execution.eventType === "QUOTE_ACCEPTED" &&
          version?.ruleId === execution.ruleId && version?.branchId === execution.branchId;
      })
      .map(execution => execution.id),
  );
  const internalExecutionSucceeded = (data.workflowActionExecutions ?? [])
    .some(action => action.actionType === "CREATE_ATTENTION" &&
      action.state === "SUCCEEDED" && verifiedLiveExecutions.has(action.executionId));

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
      status: pricing === undefined || pricing.state === "UNAVAILABLE"
        ? "UNVERIFIED" : pricingVerified ? "READY" : "ACTION_REQUIRED",
      detail: pricing === undefined || pricing.state === "UNAVAILABLE"
        ? "Price-book evidence could not be verified; do not assume rates exist."
        : pricingVerified
          ? "An active branch price book was verified."
          : "Complete the owner pricing setup before issuing customer quotes.",
      module: "settings",
    },
    {
      id: "quote-rule",
      title: "Publish an internal quote-accepted rule",
      status: !versionsLoaded ? "UNVERIFIED"
        : eligibleQuoteVersions.size > 0 ? "READY" : "ACTION_REQUIRED",
      detail: !versionsLoaded
        ? "Published rule evidence is currently unavailable."
        : eligibleQuoteVersions.size
          ? "An owner-published quote rule contains an internal attention action."
          : "Draft, preview and publish a QUOTE_ACCEPTED rule with CREATE_ATTENTION.",
      module: "automations",
    },
    {
      id: "execution-proof",
      title: "Verify a saved internal execution",
      status: !executionsLoaded ? "UNVERIFIED"
        : internalExecutionSucceeded ? "READY" : "ACTION_REQUIRED",
      detail: !executionsLoaded
        ? "Execution history is unavailable; a blank list is not evidence of zero activity."
        : internalExecutionSucceeded
          ? "A matching LIVE quote-rule execution has a succeeded internal attention receipt."
          : "A published rule alone is not execution proof. Verify a LIVE receipt.",
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
