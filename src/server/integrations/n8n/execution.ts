import type { ProviderVerificationState, RedactedProviderEvidence } from "../types";

export type N8nExecutionStatus = "success" | "failed" | "running" | "cancelled";
export type N8nDeliveryState =
  | "DELIVERED_TO_AUTOMATION"
  | "PENDING_AUTOMATION_COMPLETION"
  | "RETRYABLE_FAILURE"
  | "FINAL_FAILURE"
  | "CONFIGURATION_BLOCKED";

export interface N8nExecutionReceiptInput {
  workspaceId: string;
  workflowId: string;
  workflowName: string;
  executionId: string;
  status: N8nExecutionStatus;
  startedAt: string;
  finishedAt?: string;
  triggeredEventId: string;
  controlledReceiver: boolean;
  redactedOutputRef?: string;
  errorCode?: string;
}

export interface N8nExecutionReceipt {
  workspaceId: string;
  workflowId: string;
  workflowName: string;
  executionId: string;
  status: N8nExecutionStatus;
  deliveryState: N8nDeliveryState;
  startedAt: string;
  finishedAt?: string;
  triggeredEventId: string;
  controlledReceiver: boolean;
  redactedOutputRef?: string;
  retryRecommended: boolean;
  businessMutationAllowed: false;
  blockers: string[];
  evidence: RedactedProviderEvidence;
}

export interface N8nExecutionReceiptSummary {
  workspaceId: string;
  workflowId: string;
  executionId: string;
  status: N8nExecutionStatus;
  deliveryState: N8nDeliveryState;
  evidenceVerification: ProviderVerificationState;
  businessMutationAllowed: false;
}

const transientErrorCodes = new Set(["ECONNRESET", "ETIMEDOUT", "EAI_AGAIN", "ENOTFOUND", "HTTP_408", "HTTP_409", "HTTP_425", "HTTP_429", "HTTP_500", "HTTP_502", "HTTP_503", "HTTP_504"]);

function classifyDeliveryState(input: N8nExecutionReceiptInput): N8nDeliveryState {
  if (!input.controlledReceiver) return "CONFIGURATION_BLOCKED";
  if (input.status === "running") return "PENDING_AUTOMATION_COMPLETION";
  if (input.status === "success") return "DELIVERED_TO_AUTOMATION";
  if (input.status === "failed" && input.errorCode && transientErrorCodes.has(input.errorCode)) return "RETRYABLE_FAILURE";
  return "FINAL_FAILURE";
}

function verificationFor(input: N8nExecutionReceiptInput, state: N8nDeliveryState): ProviderVerificationState {
  if (!input.controlledReceiver || state === "CONFIGURATION_BLOCKED") return "CONFIGURATION_BLOCKED";
  return "CONTRACT_TESTED";
}

function blockersFor(input: N8nExecutionReceiptInput): string[] {
  const blockers: string[] = [];
  if (!input.controlledReceiver) blockers.push("controlled_receiver_missing");
  if (input.status === "success" && !input.redactedOutputRef) blockers.push("redacted_output_receipt_missing");
  return blockers;
}

export function buildN8nExecutionReceipt(input: N8nExecutionReceiptInput): N8nExecutionReceipt {
  const deliveryState = classifyDeliveryState(input);
  const blockers = blockersFor(input);
  const verification = verificationFor(input, deliveryState);
  const retryRecommended = deliveryState === "RETRYABLE_FAILURE";

  return {
    workspaceId: input.workspaceId,
    workflowId: input.workflowId,
    workflowName: input.workflowName,
    executionId: input.executionId,
    status: input.status,
    deliveryState,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    triggeredEventId: input.triggeredEventId,
    controlledReceiver: input.controlledReceiver,
    redactedOutputRef: input.redactedOutputRef,
    retryRecommended,
    businessMutationAllowed: false,
    blockers,
    evidence: {
      provider: "WEBHOOK",
      mode: "SANDBOX",
      verification,
      capturedAt: input.finishedAt ?? input.startedAt,
      controlledId: input.executionId,
      redactedReceipt: input.redactedOutputRef,
      notes: [
        `n8n workflow ${input.workflowId} execution ${input.status}.`,
        "Automation execution receipt is evidence of delivery to automation only, not booking/payment truth mutation.",
        ...blockers.map((blocker) => `Blocked: ${blocker}.`),
      ],
    },
  };
}

export function summarizeN8nExecutionReceipt(receipt: N8nExecutionReceipt): N8nExecutionReceiptSummary {
  return {
    workspaceId: receipt.workspaceId,
    workflowId: receipt.workflowId,
    executionId: receipt.executionId,
    status: receipt.status,
    deliveryState: receipt.deliveryState,
    evidenceVerification: receipt.evidence.verification,
    businessMutationAllowed: receipt.businessMutationAllowed,
  };
}
