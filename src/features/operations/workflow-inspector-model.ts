import type {
  OperationalStaffSnapshot,
  OperationalWorkflowActionExecution,
  OperationalWorkflowExecution,
} from "./operational-product-runtime";

/**
 * Presentation-only projection of authorized, persisted workflow evidence.
 * No network requests, provider confirmation, financial action or mutation.
 */
type WorkflowSnapshot = Pick<OperationalStaffSnapshot,
  "workflowAvailable" | "workflowExecutions" | "workflowActionExecutions" | "workflowRuleVersions">;

function latestAttempt(
  current: OperationalWorkflowActionExecution | undefined,
  candidate: OperationalWorkflowActionExecution,
): OperationalWorkflowActionExecution {
  if (!current) return candidate;
  if (candidate.attemptNumber !== current.attemptNumber) {
    return candidate.attemptNumber > current.attemptNumber ? candidate : current;
  }
  if (candidate.createdAt !== current.createdAt) {
    return candidate.createdAt > current.createdAt ? candidate : current;
  }
  return candidate.id > current.id ? candidate : current;
}

export function buildWorkflowInspector(snapshot: WorkflowSnapshot) {
  if (snapshot.workflowAvailable === false) return [];

  // An action may only be attached to an execution with the same persisted
  // execution ID AND branch ID; a rule version must also match both identities.
  const versions = new Map((snapshot.workflowRuleVersions ?? []).map(version =>
    [version.id, version] as const));
  const attempts = new Map<string, OperationalWorkflowActionExecution[]>();
  for (const action of snapshot.workflowActionExecutions ?? []) {
    if (!Number.isSafeInteger(action.actionIndex) || action.actionIndex < 0 ||
        !Number.isSafeInteger(action.attemptNumber) || action.attemptNumber < 1) continue;
    const bucket = attempts.get(action.executionId) ?? [];
    bucket.push(action);
    attempts.set(action.executionId, bucket);
  }

  return (snapshot.workflowExecutions ?? [])
    .filter(execution => execution.mode === "LIVE")
    .map((execution: OperationalWorkflowExecution) => {
      const matching = (attempts.get(execution.id) ?? [])
        .filter(action => action.branchId === execution.branchId);
      const current = new Map<number, OperationalWorkflowActionExecution>();
      for (const action of matching) {
        current.set(action.actionIndex, latestAttempt(current.get(action.actionIndex), action));
      }
      const actions = [...current.values()].sort((a, b) => a.actionIndex - b.actionIndex);
      const rule = versions.get(execution.ruleVersionId);
      const verifiedRule = rule?.ruleId === execution.ruleId &&
        rule.branchId === execution.branchId ? rule : undefined;
      return {
        ...execution,
        versionNumber: verifiedRule?.versionNumber,
        ruleEvidence: verifiedRule ? "Persisted matching rule version" as const
          : "Rule version unavailable or identity mismatched" as const,
        actions,
        attemptCount: matching.length,
        failedCount: actions.filter(action => action.state === "FAILED").length,
        approvalCount: actions.filter(action => action.state === "APPROVAL_REQUIRED").length,
        pendingCount: actions.filter(action => ["PENDING", "APPROVAL_REQUIRED", "APPROVED"].includes(action.state)).length,
        succeededCount: actions.filter(action => action.state === "SUCCEEDED").length,
        // No AI provider receipt or model-call attribution exists in this snapshot.
        aiEvidence: "Not recorded in this workflow snapshot" as const,
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
}

export type InspectedWorkflow = ReturnType<typeof buildWorkflowInspector>[number];

export function summarizeWorkflowActivity(runs: readonly InspectedWorkflow[]) {
  return {
    runs: runs.length,
    completed: runs.filter(run => run.state === "COMPLETED").length,
    failed: runs.filter(run => run.state === "PARTIAL_FAILED" || run.failedCount > 0).length,
    skipped: runs.filter(run => run.state === "SKIPPED").length,
    waitingForApproval: runs.reduce((count, run) => count + run.approvalCount, 0),
    pendingActions: runs.reduce((count, run) => count + run.pendingCount, 0),
    recordedSucceededActions: runs.reduce((count, run) => count + run.succeededCount, 0),
    // Only count complete timestamp pairs with nonnegative, finite elapsed time.
    measuredDurationMs: runs.flatMap(run => {
      if (!run.completedAt) return [];
      const start = Date.parse(run.createdAt);
      const end = Date.parse(run.completedAt);
      return Number.isFinite(start) && Number.isFinite(end) && end >= start
        ? [end - start] : [];
    }),
  };
}

export function isWorkflowAttentionRequired(run: InspectedWorkflow) {
  return run.state === "PARTIAL_FAILED" || run.failedCount > 0 ||
    run.pendingCount > 0 || run.state === "ACTIONS_PENDING";
}
