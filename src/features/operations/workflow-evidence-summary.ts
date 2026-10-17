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
  recordedActionAttempts: number;
  historicalActionAttempts: number;
  ambiguousActionSlots: number;
  providerDeliveryVerified: false;
}

export function summarizeWorkflowEvidence(input: {
  workflowExecutions?: readonly OperationalWorkflowExecution[];
  workflowActionExecutions?: readonly OperationalWorkflowActionExecution[];
}): WorkflowEvidenceSummary {
  const executions = input.workflowExecutions ?? [];
  const live = executions.filter(item => item.mode === "LIVE");
  const matchedLiveById = new Map(live.filter(item =>
    item.matched === true && typeof item.id === "string" &&
    typeof item.branchId === "string" && item.branchId.length > 0
  ).map(item => [item.id, item]));
  const validAttempts = (input.workflowActionExecutions ?? []).filter(item => {
    const parent = matchedLiveById.get(item.executionId);
    return Boolean(parent && item.branchId === parent.branchId &&
      Number.isSafeInteger(item.actionIndex) && item.actionIndex >= 0 &&
      Number.isSafeInteger(item.attemptNumber) && item.attemptNumber >= 1 &&
      ["CREATE_ATTENTION", "SEND_EMAIL_TEMPLATE", "SEND_WHATSAPP_TEMPLATE"]
        .includes(item.actionType));
  });
  // An execution's actionIndex identifies a logical action across retries.
  // Counting every FAILED attempt as a current failure overstates unfinished
  // work, while counting a historical SUCCEEDED alongside a later FAILED
  // could present an inaccurate completed outcome.
  const groups = new Map<string, OperationalWorkflowActionExecution[]>();
  for (const row of validAttempts) {
    const key = row.executionId + ":" + row.actionIndex;
    const rows = groups.get(key) ?? [];
    rows.push(row);
    groups.set(key, rows);
  }
  const current: OperationalWorkflowActionExecution[] = [];
  let ambiguousActionSlots = 0;
  let historicalActionAttempts = 0;
  for (const rows of groups.values()) {
    const maxAttempt = Math.max(...rows.map(item => item.attemptNumber));
    const latest = rows.filter(item => item.attemptNumber === maxAttempt);
    historicalActionAttempts += rows.filter(item => item.attemptNumber < maxAttempt).length;
    // Duplicate highest attempts and impossible action-type changes must
    // NEVER be promoted to current operational proof. The bounded source
    // query can also omit the actual latest attempt; this remains a sample.
    if (latest.length !== 1 ||
        rows.some(item => item.actionType !== latest[0].actionType)) {
      ambiguousActionSlots++;
      continue;
    }
    current.push(latest[0]);
  }
  const external = current.filter(item =>
    item.actionType === "SEND_EMAIL_TEMPLATE" ||
    item.actionType === "SEND_WHATSAPP_TEMPLATE");
  return {
    recordedLiveExecutions: live.length,
    matchedLiveExecutions: live.filter(item => item.matched).length,
    previewExecutions: executions.filter(item => item.mode === "PREVIEW").length,
    internalAttentionSucceeded: current.filter(item =>
      item.actionType === "CREATE_ATTENTION" && item.state === "SUCCEEDED").length,
    internalAttentionPending: current.filter(item =>
      item.actionType === "CREATE_ATTENTION" && item.state === "PENDING").length,
    externalApprovalRequired: external.filter(item => item.state === "APPROVAL_REQUIRED").length,
    approvedExternalPending: external.filter(item =>
      item.state === "APPROVED" || item.state === "PENDING").length,
    failedActions: current.filter(item => item.state === "FAILED").length,
    recordedActionAttempts: validAttempts.length,
    historicalActionAttempts,
    ambiguousActionSlots,
    providerDeliveryVerified: false,
  };
}
