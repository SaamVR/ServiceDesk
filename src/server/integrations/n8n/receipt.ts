import type { N8nDeliveryState, N8nExecutionStatus } from "./execution";

export type N8nReceiptMergeResult = "INSERTED" | "UPDATED" | "DUPLICATE_FINAL";

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
  if (current.final) return { result: "DUPLICATE_FINAL", receipt: current };
  return { result: "UPDATED", receipt: receiptFrom(update) };
}
