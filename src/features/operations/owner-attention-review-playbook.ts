import type { OwnerAttentionTriage } from "./owner-attention-triage";

export type OwnerAttentionReviewStep = {
  id: "verify-snapshot" | "inspect-quarantined" | "verify-action-evidence" |
    "review-critical" | "review-overdue" | "review-unresolved";
  title: string;
  reason: string;
  count: number | null;
  destination: "automations";
};

export type OwnerAttentionReviewPlaybook = {
  state: "VERIFY_EVIDENCE" | "REVIEW_REQUIRED" | "NO_LINKED_ATTENTION";
  steps: OwnerAttentionReviewStep[];
  disclosure: string;
};

const disclosure = "Read-only owner guidance from authorized branch-scoped saved records. No retries, outbound messages, payments, rule publishing or status changes are performed; a linked empty sample is not proof that every operational queue is clear.";

/** Fail-closed deterministic manual playbook. This function receives only the
 * server-authorized triage projection; it never reads, sends or mutates data.
 * Counts are evidence of linked records, not customer delivery or compliance.
 */
export function planOwnerAttentionReviewPlaybook(
  triage: OwnerAttentionTriage,
): OwnerAttentionReviewPlaybook {
  const verify: OwnerAttentionReviewPlaybook = {
    state: "VERIFY_EVIDENCE",
    steps: [{
      id: "verify-snapshot", title: "Verify the authorized attention snapshot",
      reason: "Branch scope, workflow linkage or current attention evidence is unavailable or contradictory. Inspect saved workflow activity before trusting counts.",
      count: null, destination: "automations",
    }],
    disclosure,
  };
  if (!triage || triage.state !== "AVAILABLE") return verify;
  const numbers = [triage.open, triage.overdue, triage.critical,
    triage.missingActionEvidence, triage.ambiguous, triage.closed];
  if (!numbers.every(value => Number.isSafeInteger(value) && value >= 0) ||
      triage.overdue > triage.open || triage.critical > triage.open ||
      triage.missingActionEvidence > triage.open ||
      !Array.isArray(triage.review) || triage.review.length > 5 ||
      triage.review.length > triage.open) return verify;
  const seen = new Set<string>();
  for (const item of triage.review) {
    if (!item || typeof item.id !== "string" || !item.id || seen.has(item.id) ||
        !["OPEN", "OVERDUE", "ACKNOWLEDGED", "EVIDENCE_GAP"].includes(item.state) ||
        !["INFO", "WARNING", "CRITICAL"].includes(item.severity)) return verify;
    seen.add(item.id);
  }
  const steps: OwnerAttentionReviewStep[] = [];
  if (triage.ambiguous > 0) steps.push({
    id: "inspect-quarantined", title: "Inspect ambiguous saved attention",
    reason: "Duplicate or unsupported saved records were quarantined. Resolve source evidence before relying on the review order.",
    count: triage.ambiguous, destination: "automations",
  });
  if (triage.missingActionEvidence > 0) steps.push({
    id: "verify-action-evidence", title: "Verify current internal-action attempts",
    reason: "Linked attention has no unique latest successful internal action proof. A historical success cannot replace the latest retry outcome.",
    count: triage.missingActionEvidence, destination: "automations",
  });
  if (triage.critical > 0) steps.push({
    id: "review-critical", title: "Prioritize critical unresolved items",
    reason: "Inspect the current saved critical items with authorized staff; the playbook does not acknowledge or escalate them automatically.",
    count: triage.critical, destination: "automations",
  });
  if (triage.overdue > 0) steps.push({
    id: "review-overdue", title: "Review past-due linked attention",
    reason: "Examine each saved due time and the related LIVE workflow evidence before deciding whether a manual follow-up is appropriate.",
    count: triage.overdue, destination: "automations",
  });
  if (triage.open > 0 && steps.length === 0) steps.push({
    id: "review-unresolved", title: "Review unresolved internal attention",
    reason: "Open or in-progress linked records still need a staff decision; no follow-up is executed here.",
    count: triage.open, destination: "automations",
  });
  return { state: steps.length ? "REVIEW_REQUIRED" : "NO_LINKED_ATTENTION",
    steps, disclosure };
}
