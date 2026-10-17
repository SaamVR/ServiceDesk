import type { OperationalStaffSnapshot } from "./operational-product-runtime";

/** Read-only interpretation of branch-scoped, persisted workflow records.
 * Never infer provider delivery, AI execution or approval from a rule match.
 */
export function buildWorkflowInspector(snapshot: Pick<OperationalStaffSnapshot,
  "workflowAvailable" | "workflowExecutions" | "workflowActionExecutions" | "workflowRuleVersions">) {
  const executions = (snapshot.workflowExecutions ?? [])
    .filter(item => item.mode === "LIVE")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
  const actions = snapshot.workflowActionExecutions ?? [];
  const versions = snapshot.workflowRuleVersions ?? [];
  return executions.map(execution => {
    const attempts = actions.filter(item => item.executionId === execution.id)
      .sort((a, b) => a.actionIndex - b.actionIndex ||
        a.attemptNumber - b.attemptNumber || a.id.localeCompare(b.id));
    const latest = [...new Map(attempts.map(a => [a.actionIndex, a])).values()];
    // The highest attempt number (not arrival order) owns current state.
    const latestByIndex = [...new Set(attempts.map(a => a.actionIndex))].map(index =>
      attempts.filter(a => a.actionIndex === index)
        .sort((a, b) => b.attemptNumber - a.attemptNumber || b.createdAt.localeCompare(a.createdAt))[0]);
    const rule = versions.find(item => item.id === execution.ruleVersionId && item.ruleId === execution.ruleId);
    return {
      ...execution,
      versionNumber: rule?.versionNumber,
      actions: latestByIndex,
      attemptCount: attempts.length,
      failedCount: latestByIndex.filter(a => a.state === "FAILED").length,
      pendingCount: latestByIndex.filter(a => ["PENDING", "APPROVAL_REQUIRED", "APPROVED"].includes(a.state)).length,
      // There is no persisted AI-call evidence in this snapshot contract.
      aiEvidence: "Not recorded in this workflow snapshot" as const,
      ruleEvidence: rule ? "Persisted rule version" as const : "Rule version unavailable" as const,
    };
  });
}
