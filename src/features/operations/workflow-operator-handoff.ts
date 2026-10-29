import {
  buildWorkflowInterventionQueue,
  classifyWorkflowIntervention,
  type InspectedWorkflow,
} from "./workflow-inspector-model";

/**
 * F14: An owner/staff handoff compiled ONLY from the already-authorized
 * browser projection of saved workflow executions. No polling, model calls,
 * service-role access, scheduling, retry or outbound provider activity.
 */
export interface WorkflowReviewHandoff {
  available: boolean;
  text: string;
  totalRuns: number;
  reviewRuns: number;
  ambiguousRuns: number;
  failedRuns: number;
  approvalRuns: number;
  processingRuns: number;
  shownReviewRuns: number;
  truncated: boolean;
  providerDeliveryVerified: false;
  canRetryOrApprove: false;
}

const eventLabels: Readonly<Record<string, string>> = {
  REQUEST_CREATED: "Request created",
  QUOTE_ACCEPTED: "Quote accepted",
  VISIT_COMPLETED: "Visit completed",
  INVOICE_PAID: "Invoice paid",
};
const reviewLabels = {
  ambiguous: "Conflicting action evidence",
  failure: "Saved failure",
  approval: "Owner approval required",
} as const;
const unavailable = (reason: string): WorkflowReviewHandoff => ({
  available: false, text: reason, totalRuns: 0, reviewRuns: 0,
  ambiguousRuns: 0, failedRuns: 0, approvalRuns: 0, processingRuns: 0,
  shownReviewRuns: 0, truncated: false,
  providerDeliveryVerified: false, canRetryOrApprove: false,
});
const safeCount = (n: unknown) =>
  typeof n === "number" && Number.isSafeInteger(n) && n >= 0 && n <= 2000;
const safeRecordedAt = (value: unknown): string | null => {
  if (typeof value !== "string" || value.length > 35 ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value))
    return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
};

export function buildWorkflowOperatorHandoff(
  runs: readonly InspectedWorkflow[],
  workflowAvailable: boolean,
  loadedAt: string,
): WorkflowReviewHandoff {
  if (workflowAvailable !== true || !Array.isArray(runs))
    return unavailable("Workflow source unavailable. No owner handoff can be inferred.");
  // The persisted client snapshot is capped at 1,000 runs. Do not attempt
  // to summarize oversized or malformed input as trustworthy evidence.
  if (runs.length > 1000 || !safeRecordedAt(loadedAt) ||
      runs.some(run => !run || typeof run.id !== "string" ||
        run.id.length < 1 || run.id.length > 128 ||
        !safeRecordedAt(run.createdAt) ||
        !["COMPLETED","PREVIEWED","SKIPPED","ACTIONS_PENDING","PARTIAL_FAILED"].includes(run.state) ||
        !safeCount(run.ambiguousActionSlots) || !safeCount(run.failedCount) ||
        !safeCount(run.approvalCount) || !safeCount(run.pendingCount)))
    return unavailable("Workflow source is incomplete or malformed. Verify the saved evidence before handoff.");

  const queue = buildWorkflowInterventionQueue(runs);
  const ambiguousRuns = queue.filter(entry => entry.kind === "ambiguous").length;
  const failedRuns = queue.filter(entry => entry.kind === "failure").length;
  const approvalRuns = queue.filter(entry => entry.kind === "approval").length;
  const processingRuns = runs.filter(run =>
    classifyWorkflowIntervention(run) === "processing").length;
  const visible = queue.slice(0, 6);
  const lines = [
    "Workflow operator review handoff — SAVED SNAPSHOT ONLY",
    "Recorded at: " + safeRecordedAt(loadedAt),
    "Loaded live runs: " + runs.length + " (bounded source; not full history)",
    "Human review runs: " + queue.length,
    "Conflicting action evidence: " + ambiguousRuns,
    "Saved failure runs: " + failedRuns,
    "Approval-required runs: " + approvalRuns,
    "Processing-only runs: " + processingRuns + " (not overdue evidence)",
    "Priority examples (up to 6, without customer or tenant identifiers):",
    ...visible.map((entry, index) => (index + 1) + ". " +
      reviewLabels[entry.kind] + " / " +
      (Object.hasOwn(eventLabels, entry.run.eventType) ? eventLabels[entry.run.eventType] : "Other recorded event")),
    ...(queue.length === 0
      ? ["No intervention is evidenced in this bounded snapshot; NOT an all-clear."]
      : queue.length > visible.length
      ? ["Additional review runs omitted: " + (queue.length - visible.length)]
      : []),
    "READ-ONLY: human approval, retries, messages, payments and rule changes are not authorized.",
    "No provider delivery or unattended processing is verified by this handoff.",
  ];
  return {
    available: true, text: lines.join("\n"), totalRuns: runs.length,
    reviewRuns: queue.length, ambiguousRuns, failedRuns, approvalRuns,
    processingRuns, shownReviewRuns: visible.length,
    truncated: queue.length > visible.length,
    providerDeliveryVerified: false, canRetryOrApprove: false,
  };
}
