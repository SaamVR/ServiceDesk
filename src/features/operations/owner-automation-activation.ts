import type { OperationalStaffSnapshot } from "./operational-product-runtime";
import { readVerifiedCustomerQuoteLineItems } from "./customer-quote-line-items";

export type ActivationStatus = "READY" | "ACTION_REQUIRED" | "UNVERIFIED";
export type ActivationStepId = "service-catalog" | "pricing" | "quote-rule" | "accepted-quote" | "execution-proof";

export interface ActivationStep {
  id: ActivationStepId;
  title: string;
  status: ActivationStatus;
  detail: string;
  module: "settings" | "automations" | "requests";
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
    "workflowRules" | "workflowRuleVersions" | "workflowExecutions" | "workflowActionExecutions"> &
    Partial<Pick<OperationalStaffSnapshot, "requests" | "quotes" | "attentionItems">>,
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
  // A published QUOTE_ACCEPTED rule is not an actual customer milestone.
  // A verified persisted quote must belong to an in-scope priced USD branch
  // and a saved request in that SAME branch. Never inherit another branch's
  // accepted quote when the owner changes the selected branch.
  const quoteRowsLoaded = Array.isArray(data.requests) && Array.isArray(data.quotes);
  const requestsById = new Map((data.requests ?? [])
    .filter(request => typeof request.id === "string" &&
      typeof request.branchId === "string" &&
      pricedBranchIds.has(request.branchId))
    .map(request => [request.id, request]));
  const acceptedSavedQuotes = (data.quotes ?? []).filter(quote => {
    const request = requestsById.get(quote.requestId);
    const branchCurrency = data.branchScope?.branches.find(
      branch => branch.id === request?.branchId)?.currency;
    if (!request || quote.status !== "ACCEPTED" ||
        quote.currency !== "USD" || quote.currency !== branchCurrency ||
        !Number.isSafeInteger(quote.totalMinor) || quote.totalMinor < 0 ||
        typeof quote.subtotalMinor !== "number" || typeof quote.taxMinor !== "number" ||
        !Number.isSafeInteger(quote.depositMinor) || quote.depositMinor < 0 ||
        !Number.isSafeInteger(quote.balanceMinor) || quote.balanceMinor < 0 ||
        quote.depositMinor + quote.balanceMinor !== quote.totalMinor ||
        !Array.isArray(quote.lineItems)) return false;
    // Match the actual owner workflow source gate, not only its status label.
    // An ACCEPTED flag without persisted, reconciled line items cannot run.
    return readVerifiedCustomerQuoteLineItems(
      { lineItems: quote.lineItems }, quote.subtotalMinor, quote.durationMinutes,
      quote.taxMinor, quote.totalMinor,
    ) !== null;
  });
  const acceptedQuoteVerified = acceptedSavedQuotes.length > 0;
  // The owner DTO includes a verified sourceQuoteId only when the existing
  // persisted execution_key exactly hashes to one authorized saved quote.
  // Joining solely by branch lets Quote A falsely certify Quote B's action.
  const acceptedQuoteBranches = new Map(acceptedSavedQuotes
    .map(quote => [quote.id, requestsById.get(quote.requestId)?.branchId] as const));
  const executionsLoaded = Array.isArray(data.workflowExecutions) &&
    Array.isArray(data.workflowActionExecutions) &&
    Array.isArray(data.attentionItems) && versionsLoaded;
  const verifiedLiveExecutions = new Map(
    (data.workflowExecutions ?? [])
      .filter(execution => {
        const version = eligibleQuoteVersions.get(execution.ruleVersionId);
        return execution.mode === "LIVE" && execution.matched === true &&
          (execution.state === "COMPLETED" || execution.state === "ACTIONS_PENDING") &&
          execution.eventType === "QUOTE_ACCEPTED" &&
          version?.ruleId === execution.ruleId && version?.branchId === execution.branchId &&
          typeof execution.sourceQuoteId === "string" &&
          acceptedQuoteBranches.get(execution.sourceQuoteId) === execution.branchId;
      })
      .flatMap(execution => {
        const version = eligibleQuoteVersions.get(execution.ruleVersionId);
        if (!version) return [];
        const requiredIndexes = version.actions.flatMap((action, index) =>
          action.type === "CREATE_ATTENTION" ? [index] : []);
        return [[execution.id, { branchId: execution.branchId, requiredIndexes }] as const];
      }),
  );
  // Partial parent state is valid if an external email awaits owner approval
  // after all required internal attention effects are saved. One succeeded
  // action is NOT enough when a rule planned several internal actions.
  const succeededIndexes = new Map<string, Set<number>>();
  for (const action of data.workflowActionExecutions ?? []) {
    const verified = verifiedLiveExecutions.get(action.executionId);
    if (!verified || action.actionType !== "CREATE_ATTENTION" ||
        action.state !== "SUCCEEDED" ||
        verified.branchId !== action.branchId ||
        !Number.isSafeInteger(action.actionIndex) ||
        !verified.requiredIndexes.includes(action.actionIndex)) continue;
    const indexes = succeededIndexes.get(action.executionId) ?? new Set<number>();
    indexes.add(action.actionIndex);
    succeededIndexes.set(action.executionId, indexes);
  }
  // An action SUCCEEDED status without a corresponding durable attention
  // item is not accepted as owner-facing quote-to-attention proof.
  const linkedAttentionIds = new Map<string, Set<string>>();
  for (const item of data.attentionItems ?? []) {
    if (item.resourceType !== "workflow_execution" ||
        item.type !== "WORKFLOW_RULE" ||
        typeof item.id !== "string" || item.id.length === 0 ||
        !verifiedLiveExecutions.has(item.resourceId)) continue;
    const ids = linkedAttentionIds.get(item.resourceId) ?? new Set<string>();
    ids.add(item.id);
    linkedAttentionIds.set(item.resourceId, ids);
  }
  const internalExecutionSucceeded = [...verifiedLiveExecutions.entries()]
    .some(([executionId, verified]) =>
      verified.requiredIndexes.length > 0 &&
      verified.requiredIndexes.every(index => succeededIndexes.get(executionId)?.has(index)) &&
      (linkedAttentionIds.get(executionId)?.size ?? 0) >= verified.requiredIndexes.length);

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
      id: "accepted-quote",
      title: "Verify a real accepted cleaning quote",
      status: !quoteRowsLoaded || !pricingScopeKnown || pricing?.state !== "VERIFIED"
        ? "UNVERIFIED" : acceptedQuoteVerified ? "READY" : "ACTION_REQUIRED",
      detail: !quoteRowsLoaded || !pricingScopeKnown || pricing?.state !== "VERIFIED"
        ? "Saved request/quote records or authorized branch pricing are unavailable; do not infer customer acceptance."
        : acceptedQuoteVerified
          ? "A saved accepted quote matches a saved request and priced, authorized USD cleaning branch. Customer-session UAT still requires independent proof."
          : "Complete a real saved request, send its quote and have the customer accept it. A published rule or simulated event is not acceptance.",
      module: "requests",
    },
    {
      id: "execution-proof",
      title: "Verify a saved internal execution",
      status: !executionsLoaded || !pricingScopeKnown ||
        pricing?.state !== "VERIFIED" ? "UNVERIFIED"
        : internalExecutionSucceeded ? "READY" : "ACTION_REQUIRED",
      detail: !executionsLoaded || !pricingScopeKnown ||
        pricing?.state !== "VERIFIED"
        ? "Authorized branch, pricing, execution or linked attention evidence is unavailable; do not claim a live result."
        : internalExecutionSucceeded
          ? "The saved LIVE execution key identifies the exact accepted quote, all required internal attention actions succeeded, and linked attention records are present. Independent customer-session UAT and provider delivery remain unverified."
          : "Verify an exact quote-sourced LIVE execution, each required succeeded internal action and its linked attention item.",
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
