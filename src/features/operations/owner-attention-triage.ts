import type {
  OperationalAttention, OperationalBranchScope, OperationalWorkflowExecution,
  OperationalWorkflowActionExecution,
} from "./operational-product-runtime";

export type OwnerAttentionTriage = {
  state: "UNVERIFIED" | "AVAILABLE";
  open: number;
  overdue: number;
  critical: number;
  missingActionEvidence: number;
  ambiguous: number;
  closed: number;
  review: Array<{
    id: string;
    severity: OperationalAttention["severity"];
    state: "OVERDUE" | "OPEN" | "ACKNOWLEDGED" | "EVIDENCE_GAP";
    guidance: string;
  }>;
};

/** Owner-only, READ-ONLY guidance from the already authorized snapshot.
 * An attention row is scoped through a saved LIVE workflow execution because
 * attention DTOs have no branchId. The server must independently authorize
 * workspace and branch reads; this projection grants no new access.
 */
export function summarizeOwnerAttentionTriage(input: {
  loadedAt: string;
  branchScope?: OperationalBranchScope;
  workflowAvailable?: boolean;
  workflowExecutions?: readonly OperationalWorkflowExecution[];
  workflowActionExecutions?: readonly OperationalWorkflowActionExecution[];
  attentionItems?: readonly OperationalAttention[];
}): OwnerAttentionTriage {
  const empty: OwnerAttentionTriage = {
    state: "UNVERIFIED", open: 0, overdue: 0, critical: 0,
    missingActionEvidence: 0, ambiguous: 0, closed: 0, review: [],
  };
  const scope = input.branchScope;
  const checkedAt = Date.parse(input.loadedAt);
  if (input.workflowAvailable !== true ||
      !Number.isFinite(checkedAt) ||
      !scope || scope.mode === "LEGACY" || !Array.isArray(scope.branches) ||
      !scope.branches.length || !Array.isArray(input.workflowExecutions) ||
      !Array.isArray(input.workflowActionExecutions) ||
      !Array.isArray(input.attentionItems)) return empty;
  const allowed = new Set(scope.branches.map(branch => branch.id));
  if (allowed.size !== scope.branches.length || [...allowed].some(id => !id) ||
      (scope.mode === "BRANCH" && !allowed.has(scope.selectedBranchId ?? ""))) return empty;
  const selected = scope.mode === "BRANCH"
    ? new Set([scope.selectedBranchId]) : allowed;
  const live = new Map(input.workflowExecutions
    .filter(row => row.mode === "LIVE" && row.matched === true &&
      selected.has(row.branchId) && typeof row.id === "string" && row.id.length > 0)
    .map(row => [row.id, row]));
  // Current action proof is the unique highest attempt in a logical slot.
  // Two top attempts or malformed retry metadata never prove success.
  const actionAttempts = new Map<string, Map<number, OperationalWorkflowActionExecution[]>>();
  const invalid = new Set<string>();
  for (const row of input.workflowActionExecutions) {
    const parent = live.get(row.executionId);
    if (!parent) continue;
    if (row.branchId !== parent.branchId || !Number.isSafeInteger(row.actionIndex) ||
        row.actionIndex < 0 || !Number.isSafeInteger(row.attemptNumber) ||
        row.attemptNumber < 1) {
      invalid.add(parent.id);
      continue;
    }
    const slots = actionAttempts.get(parent.id) ?? new Map();
    const attempts = slots.get(row.actionIndex) ?? [];
    attempts.push(row);
    slots.set(row.actionIndex, attempts);
    actionAttempts.set(parent.id, slots);
  }
  const withSavedInternalSuccess = new Set<string>();
  for (const [id, slots] of actionAttempts) {
    if (invalid.has(id)) continue;
    for (const attempts of slots.values()) {
      const highest = Math.max(...attempts.map(row => row.attemptNumber));
      const current = attempts.filter(row => row.attemptNumber === highest);
      if (current.length !== 1 ||
          attempts.some(row => row.actionType !== "CREATE_ATTENTION")) {
        invalid.add(id);
        break;
      }
    }
    if (!invalid.has(id) && [...slots.values()].some(attempts => {
      const highest = Math.max(...attempts.map(row => row.attemptNumber));
      return attempts.find(row => row.attemptNumber === highest)?.state === "SUCCEEDED";
    })) withSavedInternalSuccess.add(id);
  }
  const unique = new Map<string, OperationalAttention>();
  const duplicates = new Set<string>();
  for (const item of input.attentionItems) {
    if (item.type !== "WORKFLOW_RULE" || item.resourceType !== "workflow_execution" ||
        !live.has(item.resourceId) || typeof item.id !== "string" || !item.id) continue;
    if (unique.has(item.id)) duplicates.add(item.id);
    unique.set(item.id, item);
  }
  const result: OwnerAttentionTriage = { ...empty, state: "AVAILABLE" };
  const queue: Array<OwnerAttentionTriage["review"][number] & { rank: number }> = [];
  for (const [id, item] of unique) {
    if (duplicates.has(id) || !["INFO", "WARNING", "CRITICAL"].includes(item.severity)) {
      result.ambiguous++;
      continue;
    }
    if (item.status === "RESOLVED" || item.status === "DISMISSED") {
      result.closed++;
      continue;
    }
    if (!["OPEN", "ACKNOWLEDGED", "IN_PROGRESS"].includes(item.status)) {
      result.ambiguous++;
      continue;
    }
    result.open++;
    const time = item.dueAt ? Date.parse(item.dueAt) : NaN;
    const overdue = Number.isFinite(time) && time < checkedAt;
    if (overdue) result.overdue++;
    if (item.severity === "CRITICAL") result.critical++;
    const evidenceGap = !withSavedInternalSuccess.has(item.resourceId);
    if (evidenceGap) result.missingActionEvidence++;
    const state = evidenceGap ? "EVIDENCE_GAP"
      : overdue ? "OVERDUE" : item.status === "OPEN" ? "OPEN" : "ACKNOWLEDGED";
    const guidance = evidenceGap
      ? "Inspect the linked execution: a current successful internal action is not verified."
      : overdue ? "An unresolved internal review item is past its saved due time."
      : item.status === "OPEN" ? "Review this saved internal attention item."
      : "Follow up on an acknowledged or in-progress attention item.";
    queue.push({ id, severity: item.severity, state, guidance,
      rank: (evidenceGap ? 100 : 0) + (overdue ? 50 : 0) +
        (item.severity === "CRITICAL" ? 30 : item.severity === "WARNING" ? 20 : 10) });
  }
  result.review = queue.sort((a, b) => b.rank - a.rank || a.id.localeCompare(b.id))
    .slice(0, 5).map(({ rank: _rank, ...item }) => item);
  return result;
}
