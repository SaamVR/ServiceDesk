import type { OperationalStaffSnapshot } from "./operational-product-runtime";

/**
 * Explicit privacy boundary: a server-rendered page must not hand an entire
 * operational staff snapshot to a client component. Only already-authorized
 * workflow metadata required by the read-only inspector is exposed.
 */
export type WorkflowInspectorClientSnapshot = Pick<OperationalStaffSnapshot,
  "loadedAt" | "workflowAvailable" | "workflowExecutions" |
  "workflowActionExecutions" | "workflowRuleVersions">;

export function selectWorkflowInspectorClientSnapshot(
  snapshot: OperationalStaffSnapshot,
): WorkflowInspectorClientSnapshot {
  return {
    loadedAt: snapshot.loadedAt,
    workflowAvailable: snapshot.workflowAvailable,
    workflowExecutions: snapshot.workflowExecutions,
    workflowActionExecutions: snapshot.workflowActionExecutions,
    workflowRuleVersions: snapshot.workflowRuleVersions,
  };
}
