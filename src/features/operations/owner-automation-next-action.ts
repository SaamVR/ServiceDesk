import type { ActivationStepId, AutomationActivationSummary } from "./owner-automation-activation";
import type { StaffModule } from "./staff-modules";

export type OwnerAutomationNextAction =
  | { state: "SOURCE_READY"; pendingCount: 0; stepId: null; title: string; detail: string; module: null; pricingAnchor: false; label: null }
  | { state: "ACTION_REQUIRED" | "VERIFY_EVIDENCE"; pendingCount: number; stepId: ActivationStepId;
      title: string; detail: string; module: StaffModule; pricingAnchor: boolean; label: string };

/**
 * Deterministic, read-only owner remediation sequence. The five prerequisites
 * come from a previously authorized workspace snapshot, never from AI guesses.
 * No action is executed; a recommended destination always remains owner-gated.
 */
export function planOwnerAutomationNextAction(
  summary: AutomationActivationSummary,
  canOpenPricingForm: boolean,
): OwnerAutomationNextAction {
  const expected: ActivationStepId[] = [
    "service-catalog", "pricing", "quote-rule", "accepted-quote", "execution-proof",
  ];
  const valid = summary.steps.length === expected.length &&
    expected.every((id, index) => summary.steps[index]?.id === id) &&
    summary.steps.every(s => ["READY", "ACTION_REQUIRED", "UNVERIFIED"].includes(s.status));
  if (!valid) {
    return {
      state: "VERIFY_EVIDENCE", pendingCount: expected.length,
      stepId: "service-catalog", title: "Verify workspace activation evidence",
      detail: "The saved activation checklist could not be reconciled. Refresh the owner workspace before acting.",
      module: "settings", pricingAnchor: false, label: "Review owner Settings",
    };
  }
  const remaining = summary.steps.filter(step => step.status !== "READY");
  if (remaining.length === 0) {
    return {
      state: "SOURCE_READY", pendingCount: 0, stepId: null,
      title: "Saved internal activation evidence is present",
      detail: "Source-linked prerequisites are recorded. Real signed-in customer testing, external provider delivery, payment and deployment are separate acceptance gates.",
      module: null, pricingAnchor: false, label: null,
    };
  }
  const step = remaining[0];
  const state = step.status === "UNVERIFIED" ? "VERIFY_EVIDENCE" : "ACTION_REQUIRED";
  const actions: Record<ActivationStepId, { title: string; label: string; module: StaffModule }> = {
    "service-catalog": { title: "Configure supported cleaning services", label: "Review cleaning catalog", module: "settings" },
    "pricing": {
      title: state === "VERIFY_EVIDENCE" ? "Verify saved branch pricing" : "Set up real branch pricing",
      label: state === "VERIFY_EVIDENCE" ? "Verify pricing in Settings"
        : canOpenPricingForm ? "Enter actual branch rates" : "Review saved pricing",
      module: "settings",
    },
    "quote-rule": { title: "Review the approved quote-accepted automation", label: "Open Automation Studio", module: "automations" },
    "accepted-quote": { title: "Review real accepted customer quotes", label: "Review saved customer requests", module: "requests" },
    "execution-proof": { title: "Check persisted internal automation evidence", label: "Inspect automation executions", module: "automations" },
  };
  const action = actions[step.id];
  return {
    state, stepId: step.id, pendingCount: remaining.length,
    title: action.title, label: action.label, module: action.module,
    detail: state === "VERIFY_EVIDENCE"
      ? "Saved evidence is unavailable; review this prerequisite before changing automation settings. " + step.detail
      : step.detail,
    pricingAnchor: step.id === "pricing" && state === "ACTION_REQUIRED" && canOpenPricingForm,
  };
}
