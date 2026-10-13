import type { N8nDeliveryState, N8nExecutionStatus } from "./execution";

export type N8nReceiptMergeResult = "INSERTED" | "UPDATED" | "DUPLICATE_FINAL" | "IDENTITY_MISMATCH" | "STALE_UPDATE";

export interface N8nReceiptKeyInput {
  workspaceId: string;
  workflowId: string;
  executionId: string;
  triggeredEventId: string;
}

export interface N8nExecutionReceiptUpdate extends N8nReceiptKeyInput {
  status: N8nExecutionStatus;
  deliveryState: N8nDeliveryState;
  capturedAt: string;
}

export interface N8nDurableExecutionReceipt extends N8nExecutionReceiptUpdate {
  receiptKey: string;
  final: boolean;
  businessMutationAllowed: false;
}

export interface N8nReceiptMergeDecision {
  result: N8nReceiptMergeResult;
  receipt: N8nDurableExecutionReceipt;
}

export function n8nReceiptKey(input: N8nReceiptKeyInput): string {
  return `n8n:${input.workspaceId}:${input.workflowId}:${input.executionId}:${input.triggeredEventId}`;
}

function finalState(deliveryState: N8nDeliveryState): boolean {
  return deliveryState === "DELIVERED_TO_AUTOMATION" || deliveryState === "FINAL_FAILURE" || deliveryState === "CONFIGURATION_BLOCKED";
}

function receiptFrom(update: N8nExecutionReceiptUpdate): N8nDurableExecutionReceipt {
  return {
    ...update,
    receiptKey: n8nReceiptKey(update),
    final: finalState(update.deliveryState),
    businessMutationAllowed: false,
  };
}

export function mergeN8nExecutionReceipt(
  current: N8nDurableExecutionReceipt | undefined,
  update: N8nExecutionReceiptUpdate,
): N8nReceiptMergeDecision {
  if (!current) return { result: "INSERTED", receipt: receiptFrom(update) };
  // This boundary must never let a late callback for another tenant or
  // workflow replace the verified current receipt, even if caller supplied
  // the wrong cache key. Compare individual identity fields as well as key.
  if (current.workspaceId !== update.workspaceId ||
      current.workflowId !== update.workflowId ||
      current.executionId !== update.executionId ||
      current.triggeredEventId !== update.triggeredEventId ||
      current.receiptKey !== n8nReceiptKey(update)) {
    return { result: "IDENTITY_MISMATCH", receipt: current };
  }
  if (current.final) return { result: "DUPLICATE_FINAL", receipt: current };
  const previousTime = Date.parse(current.capturedAt);
  const incomingTime = Date.parse(update.capturedAt);
  if (!Number.isFinite(previousTime) || !Number.isFinite(incomingTime) ||
      incomingTime <= previousTime) {
    return { result: "STALE_UPDATE", receipt: current };
  }
  return { result: "UPDATED", receipt: receiptFrom(update) };
}
