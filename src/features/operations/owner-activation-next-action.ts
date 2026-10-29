import type { AutomationActivationSummary, ActivationStep, ActivationStepId } from "./owner-automation-activation";

export interface OwnerActivationNextAction {
  state: "SETUP_REQUIRED" | "VERIFY_SAVED_EVIDENCE" | "REVIEW_LIVE_RECEIPT" | "SOURCE_READY_NOT_DEPLOYED";
  stepId: ActivationStepId | null;
  title: string;
  detail: string;
  linkLabel: string;
  module: "settings" | "automations" | "requests";
  anchor: "" | "#owner-first-run-pricing";
  readyForOwnerOptIn: boolean;
  providerDeliveryVerified: false;
  liveDeploymentAuthorized: false;
}

const stepOrder: readonly ActivationStepId[] = [
  "service-catalog", "pricing", "quote-rule", "accepted-quote", "execution-proof",
];
const stepModules: Record<ActivationStepId, ActivationStep["module"]> = {
  "service-catalog": "settings",
  pricing: "settings",
  "quote-rule": "automations",
  "accepted-quote": "requests",
  "execution-proof": "automations",
};
const blocked = (): OwnerActivationNextAction => ({
  state: "VERIFY_SAVED_EVIDENCE", stepId: null,
  title: "Recheck saved owner and branch evidence",
  detail: "The activation readout is missing or contradictory. Refresh the authorized workspace before attempting to enable automation.",
  linkLabel: "Review workspace Settings", module: "settings", anchor: "",
  readyForOwnerOptIn: false,
  providerDeliveryVerified: false, liveDeploymentAuthorized: false,
});

/**
 * P33: Turn source-proven activation steps into one accurate next action.
 * The first three steps gate the INITIAL owner opt-in; a saved customer
 * acceptance and internal execution are later outcomes, never prerequisites
 * that deadlock the first opt-in. Not a provider or live deployment receipt.
 */
export function buildOwnerActivationNextAction(
  summary: AutomationActivationSummary, canOpenFirstRunUsdPricing: boolean,
): OwnerActivationNextAction {
  if (!summary || !Array.isArray(summary.steps) ||
      summary.steps.length !== stepOrder.length ||
      !Number.isSafeInteger(summary.readyCount) ||
      summary.total !== stepOrder.length ||
      summary.readyCount < 0 || summary.readyCount > stepOrder.length ||
      typeof canOpenFirstRunUsdPricing !== "boolean") return blocked();

  const found = new Map<ActivationStepId, ActivationStep>();
  for (const step of summary.steps) {
    if (!step || !stepOrder.includes(step.id) ||
        !["READY","ACTION_REQUIRED","UNVERIFIED"].includes(step.status) ||
        step.module !== stepModules[step.id] || found.has(step.id)) return blocked();
    found.set(step.id, step);
  }
  if (found.size !== stepOrder.length ||
      [...found.values()].filter(step => step.status === "READY").length !== summary.readyCount ||
      summary.allEvidenceReady !== (summary.readyCount === stepOrder.length)) return blocked();

  const earliest = stepOrder.map(id => found.get(id)!).find(step => step.status !== "READY");
  const canOptIn = stepOrder.slice(0,3).every(id => found.get(id)?.status === "READY");
  if (!earliest) {
    return {
      state: "SOURCE_READY_NOT_DEPLOYED", stepId: null,
      title: "Saved internal evidence is present",
      detail: "Reconcile authenticated customer and provider receipts separately. This readout does not activate delivery or authorize deployment.",
      linkLabel: "Review Automation Studio", module: "automations", anchor: "",
      readyForOwnerOptIn: true,
      providerDeliveryVerified: false, liveDeploymentAuthorized: false,
    };
  }
  const unverified = earliest.status === "UNVERIFIED";
  const pricingFirstRun = earliest.id === "pricing" && !unverified &&
    canOpenFirstRunUsdPricing;
  const afterOptIn = canOptIn && (earliest.id === "accepted-quote" ||
    earliest.id === "execution-proof");
  const linkLabel = earliest.id === "service-catalog" ? "Review cleaning service catalog"
    : earliest.id === "pricing"
      ? pricingFirstRun ? "Enter actual USD prices" : "Review saved branch pricing"
    : earliest.id === "quote-rule" ? "Review published internal rules"
    : earliest.id === "accepted-quote" ? "Review saved requests and quotes"
    : "Inspect saved execution and attention";
  return {
    state: unverified ? "VERIFY_SAVED_EVIDENCE" :
      afterOptIn ? "REVIEW_LIVE_RECEIPT" : "SETUP_REQUIRED",
    stepId: earliest.id,
    title: unverified ? "Verify missing saved evidence: " + earliest.title :
      afterOptIn ? "Verify an actual source outcome: " + earliest.title :
      "Complete next setup step: " + earliest.title,
    detail: unverified
      ? earliest.detail + " No positive readiness or provider execution is implied."
      : afterOptIn
        ? earliest.detail + " A prepared workspace alone is not a saved customer or worker receipt."
        : earliest.detail,
    linkLabel,
    module: earliest.module,
    anchor: pricingFirstRun ? "#owner-first-run-pricing" : "",
    readyForOwnerOptIn: canOptIn,
    providerDeliveryVerified: false, liveDeploymentAuthorized: false,
  };
}
