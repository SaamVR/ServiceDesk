import type {
  OperationalStaffSnapshot,
  OperationalWorkflowActionExecution,
  OperationalWorkflowExecution,
  OperationalWorkflowRuleVersion,
} from "./operational-product-runtime";

/** Browser DTOs are explicit field allowlists, not full database row types. */
export type BrowserWorkflowRule = Pick<OperationalWorkflowRuleVersion,
  "id" | "branchId" | "ruleId" | "versionNumber">;

export type BrowserWorkflowExecution = Pick<OperationalWorkflowExecution,
  "id" | "branchId" | "ruleId" | "ruleVersionId" | "sourceQuoteId" |
  "mode" | "eventType" | "matched" | "state" | "createdAt" | "completedAt">;

export type BrowserWorkflowAction = Pick<OperationalWorkflowActionExecution,
  "id" | "branchId" | "executionId" | "actionIndex" | "attemptNumber" |
  "actionType" | "state" | "approvedAt" | "errorCode" |
  "replayOfActionExecutionId" | "createdAt" | "completedAt">;

export interface WorkflowInspectorClientSnapshot {
  loadedAt: string;
  workflowAvailable?: boolean;
  workflowExecutions?: BrowserWorkflowExecution[];
  workflowActionExecutions?: BrowserWorkflowAction[];
  workflowRuleVersions?: BrowserWorkflowRule[];
}

// A generic [A-Z_]+ pattern is not sufficient: secret-like values such as
// PRIVATE_API_TOKEN would pass it. Only known operator-safe machine codes may
// cross into an authenticated browser, not provider text or arbitrary codes.
const PUBLIC_WORKFLOW_ERROR_CODES = new Set([
  "WORKFLOW_EXTERNAL_SEND_CONFIGURATION_BLOCKED",
  "WORKFLOW_ACTION_RESULT_RPC_ERROR",
  "RATE_LIMITED",
]);

function safeErrorCode(value: string | undefined) {
  return typeof value === "string" && PUBLIC_WORKFLOW_ERROR_CODES.has(value)
    ? value : undefined;
}

/**
 * Server-to-client privacy boundary. Deliberately project EACH row, not only
 * the top-level snapshot: rule conditions/actions may contain confidential
 * merchant configuration and are never needed by this view.
 */
export function selectWorkflowInspectorClientSnapshot(
  snapshot: OperationalStaffSnapshot,
): WorkflowInspectorClientSnapshot {
  // A read failure or unavailable workflow feature must not serialize stale
  // or partial evidence. Callers cannot equate that situation with zero runs.
  if (snapshot.workflowAvailable !== true ||
      !Array.isArray(snapshot.workflowExecutions) ||
      !Array.isArray(snapshot.workflowActionExecutions) ||
      !Array.isArray(snapshot.workflowRuleVersions)) {
    return { loadedAt: snapshot.loadedAt, workflowAvailable: false };
  }
  return {
    loadedAt: snapshot.loadedAt,
    workflowAvailable: snapshot.workflowAvailable,
    workflowExecutions: snapshot.workflowExecutions?.map(item => ({
      id: item.id,
      branchId: item.branchId,
      ruleId: item.ruleId,
      ruleVersionId: item.ruleVersionId,
      sourceQuoteId: item.sourceQuoteId,
      mode: item.mode,
      eventType: item.eventType,
      matched: item.matched,
      state: item.state,
      createdAt: item.createdAt,
      completedAt: item.completedAt,
    })),
    workflowActionExecutions: snapshot.workflowActionExecutions?.map(item => ({
      id: item.id,
      branchId: item.branchId,
      executionId: item.executionId,
      actionIndex: item.actionIndex,
      attemptNumber: item.attemptNumber,
      actionType: item.actionType,
      state: item.state,
      approvedAt: item.approvedAt,
      errorCode: safeErrorCode(item.errorCode),
      replayOfActionExecutionId: item.replayOfActionExecutionId,
      createdAt: item.createdAt,
      completedAt: item.completedAt,
    })),
    workflowRuleVersions: snapshot.workflowRuleVersions?.map(rule => ({
      id: rule.id,
      branchId: rule.branchId,
      ruleId: rule.ruleId,
      versionNumber: rule.versionNumber,
    })),
  };
}
