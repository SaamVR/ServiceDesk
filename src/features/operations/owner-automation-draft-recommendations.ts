import type { AutomationActivationSummary } from "./owner-automation-activation";
import type { OwnerAttentionTriage } from "./owner-attention-triage";
import { automationPlaybooks } from "./automation-playbooks";

export interface OwnerDraftStarterRecommendation {
  id: string;
  name: string;
  why: string;
  kind: "OWNER_REVIEW_DRAFT_ONLY";
}

const byId = new Map(automationPlaybooks.map(playbook => [playbook.id, playbook]));

/** Suggest bounded, preexisting internal-only draft recipes based on independently
 * saved owner readiness/attention. A recommendation cannot publish a rule,
 * prove branch pricing, schedule an action, or send a customer message.
 * Unknown evidence must never be relabeled operationally ready.
 */
export function recommendOwnerAutomationDrafts(input: {
  activation: AutomationActivationSummary;
  attention: OwnerAttentionTriage;
  authorizedBranchKnown: boolean;
}): OwnerDraftStarterRecommendation[] {
  if (!input.authorizedBranchKnown ||
      !Array.isArray(input.activation.steps) ||
      input.activation.steps.length !== 5 ||
      input.activation.steps.some(step => !["READY", "ACTION_REQUIRED", "UNVERIFIED"].includes(step.status)))
    return [];
  const status = new Map(input.activation.steps.map(step => [step.id, step.status]));
  if (status.size !== 5 || !["service-catalog", "pricing", "quote-rule",
      "accepted-quote", "execution-proof"].every(id => status.has(id))) return [];
  const recommendations: Array<{ id: string; why: string }> = [];
  if (input.attention.state === "AVAILABLE" && input.attention.critical > 0) {
    recommendations.push({ id: "critical-attention",
      why: "Critical saved workflow attention needs owner review; this starter is only a new draft." });
  }
  if (input.attention.state === "AVAILABLE" && input.attention.missingActionEvidence > 0) {
    recommendations.push({ id: "warning-attention",
      why: "Some linked attention lacks verified current action success. Inspect records before drafting a separate exception rule." });
  }
  if (status.get("service-catalog") !== "READY") {
    recommendations.push({ id: "new-enquiry",
      why: "Cleaning catalog readiness is not established. Review actual services in Settings before considering an intake draft." });
  } else if (status.get("pricing") !== "READY") {
    recommendations.push({ id: "branch-routing",
      why: "Branch pricing is incomplete or unverified. This is a routing-review draft, not permission to quote." });
  } else if (status.get("quote-rule") !== "READY") {
    recommendations.push({ id: "quote-accepted",
      why: "No verified internal quote-accepted rule is currently credited. Owner review and publication remain separate." });
  } else if (status.get("execution-proof") !== "READY") {
    recommendations.push({ id: "attention-opened",
      why: "Saved quote-to-attention execution is not proved. Review existing activity before drafting any follow-up." });
  }
  const seen = new Set<string>();
  return recommendations.filter(item => {
    if (seen.has(item.id) || !byId.has(item.id)) return false;
    seen.add(item.id);
    return true;
  }).slice(0, 3).map(item => ({
    id: item.id, name: byId.get(item.id)!.name,
    why: item.why, kind: "OWNER_REVIEW_DRAFT_ONLY" as const,
  }));
}
