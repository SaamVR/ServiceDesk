import type {
  BrowserWorkflowAction,
  BrowserWorkflowExecution,
  WorkflowInspectorClientSnapshot,
} from "./workflow-inspector-client-snapshot";

/**
 * Presentation-only projection of authorized, persisted workflow evidence.
 * No network requests, provider confirmation, financial action or mutation.
 */
type WorkflowSnapshot = Pick<WorkflowInspectorClientSnapshot,
  "workflowAvailable" | "workflowExecutions" | "workflowActionExecutions" | "workflowRuleVersions">;

export function buildWorkflowInspector(snapshot: WorkflowSnapshot) {
  if (snapshot.workflowAvailable !== true) return [];

  // An action may only be attached to an execution with the same persisted
  // execution ID AND branch ID; a rule version must also match both identities.
  const versions = new Map((snapshot.workflowRuleVersions ?? []).map(version =>
    [version.id, version] as const));
  const attempts = new Map<string, BrowserWorkflowAction[]>();
  for (const action of snapshot.workflowActionExecutions ?? []) {
    if (!Number.isSafeInteger(action.actionIndex) || action.actionIndex < 0 ||
        !Number.isSafeInteger(action.attemptNumber) || action.attemptNumber < 1) continue;
    const bucket = attempts.get(action.executionId) ?? [];
    bucket.push(action);
    attempts.set(action.executionId, bucket);
  }

  return (snapshot.workflowExecutions ?? [])
    .filter(execution => execution.mode === "LIVE")
    .map((execution: BrowserWorkflowExecution) => {
      const matching = (attempts.get(execution.id) ?? [])
        .filter(action => action.branchId === execution.branchId);
      const groups = new Map<number, BrowserWorkflowAction[]>();
      for (const action of matching) {
        const slot = groups.get(action.actionIndex) ?? [];
        slot.push(action);
        groups.set(action.actionIndex, slot);
      }
      const actions: BrowserWorkflowAction[] = [];
      let ambiguousActionSlots = 0;
      for (const slot of groups.values()) {
        const lastAttempt = Math.max(...slot.map(action => action.attemptNumber));
        const latest = slot.filter(action => action.attemptNumber === lastAttempt);
        // Duplicate highest attempts or changed action type can never be
        // promoted to a verified current state by timestamp/ID tie-breaks.
        if (latest.length !== 1 || slot.some(action =>
          action.actionType !== latest[0].actionType)) {
          ambiguousActionSlots++;
          continue;
        }
        actions.push(latest[0]);
      }
      actions.sort((a, b) => a.actionIndex - b.actionIndex);
      // Preserve all validated retry rows for the inspector. Summary metrics
      // still count only each action index's latest persisted attempt.
      const attemptHistory = [...matching].sort((a, b) =>
        a.actionIndex - b.actionIndex ||
        b.attemptNumber - a.attemptNumber ||
        b.createdAt.localeCompare(a.createdAt) ||
        b.id.localeCompare(a.id));
      const rule = versions.get(execution.ruleVersionId);
      const verifiedRule = rule?.ruleId === execution.ruleId &&
        rule.branchId === execution.branchId ? rule : undefined;
      return {
        ...execution,
        versionNumber: verifiedRule?.versionNumber,
        ruleEvidence: verifiedRule ? "Persisted matching rule version" as const
          : "Rule version unavailable or identity mismatched" as const,
        actions,
        attemptHistory,
        attemptCount: matching.length,
        ambiguousActionSlots,
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
    ambiguousActionSlots: runs.reduce((count, run) => count + run.ambiguousActionSlots, 0),
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

/** Categorize persisted outcomes without inventing a required user action.
 * Processing is informational; only a failed run or an action explicitly
 * marked APPROVAL_REQUIRED belongs in the human intervention queue.
 */
export type WorkflowInterventionKind = "failure" | "ambiguous" | "approval" | "processing";

export function classifyWorkflowIntervention(run: InspectedWorkflow):
  WorkflowInterventionKind | undefined {
  if (run.ambiguousActionSlots > 0) return "ambiguous";
  if (run.failedCount > 0 || run.state === "PARTIAL_FAILED") return "failure";
  if (run.approvalCount > 0) return "approval";
  if (run.pendingCount > 0 || run.state === "ACTIONS_PENDING") return "processing";
  return undefined;
}

export function isWorkflowAttentionRequired(run: InspectedWorkflow) {
  const kind = classifyWorkflowIntervention(run);
  return kind === "failure" || kind === "ambiguous" || kind === "approval";
}

export function buildWorkflowInterventionQueue(runs: readonly InspectedWorkflow[]) {
  const order = { ambiguous: 0, failure: 1, approval: 2 } as const;
  return runs.flatMap(run => {
    const kind = classifyWorkflowIntervention(run);
    return kind === "failure" || kind === "ambiguous" || kind === "approval"
      ? [{ run, kind }] : [];
  }).sort((a, b) => order[a.kind] - order[b.kind] ||
    b.run.createdAt.localeCompare(a.run.createdAt) ||
    a.run.id.localeCompare(b.run.id));
}
