import type {
  OperationalWorkflowActionExecution,
  OperationalWorkflowExecution,
} from "./operational-product-runtime";

/**
 * This only summarizes persisted, authorized workspace snapshot rows.
 * It does NOT infer provider delivery from queued/succeeded workflow actions.
 * Action rows may contain retries; labels describe durable row counts.
 */
export interface WorkflowEvidenceSummary {
  recordedLiveExecutions: number;
  matchedLiveExecutions: number;
  previewExecutions: number;
  internalAttentionSucceeded: number;
  internalAttentionPending: number;
  externalApprovalRequired: number;
  approvedExternalPending: number;
  failedActions: number;
  providerDeliveryVerified: false;
}

export function summarizeWorkflowEvidence(input: {
  workflowExecutions?: readonly OperationalWorkflowExecution[];
  workflowActionExecutions?: readonly OperationalWorkflowActionExecution[];
}): WorkflowEvidenceSummary {
  const executions = input.workflowExecutions ?? [];
  const live = executions.filter(item => item.mode === "LIVE");
  // Only linked LIVE actions may be displayed as persisted business workflow
  // activity. Synthetic previews cannot inflate success/failure counters.
  const matchedLiveById = new Map(live.filter(item =>
    item.matched === true && typeof item.id === "string" &&
    typeof item.branchId === "string" &&
    item.branchId.length > 0).map(item => [item.id, item]));
  const actions = (input.workflowActionExecutions ?? []).filter(item => {
    const parent = matchedLiveById.get(item.executionId);
    // Only count rows associated with a matched LIVE execution in the same
    // branch; an unrelated or cross-branch row must not inflate owner proof.
    // This is still a persisted row count, not independent provider delivery.
    return Boolean(parent && item.branchId === parent.branchId &&
      Number.isSafeInteger(item.actionIndex) && item.actionIndex >= 0 &&
      Number.isSafeInteger(item.attemptNumber) && item.attemptNumber >= 1);
  });
  return {
    recordedLiveExecutions: live.length,
    matchedLiveExecutions: live.filter(item => item.matched).length,
    previewExecutions: executions.filter(item => item.mode === "PREVIEW").length,
    internalAttentionSucceeded: actions.filter(item =>
      item.actionType === "CREATE_ATTENTION" && item.state === "SUCCEEDED").length,
    internalAttentionPending: actions.filter(item =>
      item.actionType === "CREATE_ATTENTION" && item.state === "PENDING").length,
    externalApprovalRequired: actions.filter(item =>
      (item.actionType === "SEND_EMAIL_TEMPLATE" || item.actionType === "SEND_WHATSAPP_TEMPLATE") &&
      item.state === "APPROVAL_REQUIRED").length,
    approvedExternalPending: actions.filter(item =>
      (item.actionType === "SEND_EMAIL_TEMPLATE" || item.actionType === "SEND_WHATSAPP_TEMPLATE") &&
      (item.state === "APPROVED" || item.state === "PENDING")).length,
    failedActions: actions.filter(item => item.state === "FAILED").length,
    providerDeliveryVerified: false,
  };
}
