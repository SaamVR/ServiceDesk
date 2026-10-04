import type { ProviderVerificationState } from "../types";
import type { N8nExecutionReceipt } from "../n8n/execution";
import type { WebhookExecutionResult } from "./executor";

export type WebhookN8nLinkageState = "LINKED" | "WEBHOOK_NOT_DELIVERED" | "EVENT_MISMATCH" | "N8N_NOT_COMPLETE" | "CONFIGURATION_BLOCKED";

export interface WebhookN8nLinkageReceipt {
  eventId: string;
  workflowId: string;
  executionId: string;
  webhookOutcome: WebhookExecutionResult["outcome"];
  n8nDeliveryState: N8nExecutionReceipt["deliveryState"];
  linkageState: WebhookN8nLinkageState;
  requiresOperator: boolean;
  evidenceVerification: ProviderVerificationState;
  businessMutationAllowed: false;
  notes: string[];
}

export function linkWebhookDeliveryToN8nExecution(
  webhook: WebhookExecutionResult,
  receipt: N8nExecutionReceipt,
): WebhookN8nLinkageReceipt {
  const notes: string[] = [];
  let linkageState: WebhookN8nLinkageState = "LINKED";
  let requiresOperator = false;

  if (webhook.outcome !== "DELIVERED") {
    linkageState = "WEBHOOK_NOT_DELIVERED";
    requiresOperator = true;
    notes.push("Webhook delivery did not succeed; n8n execution cannot be used as delivery proof for this event.");
  } else if (webhook.eventId !== receipt.triggeredEventId) {
    linkageState = "EVENT_MISMATCH";
    requiresOperator = true;
    notes.push("n8n execution receipt references a different ServiceDesk event ID.");
  } else if (receipt.deliveryState === "CONFIGURATION_BLOCKED") {
    linkageState = "CONFIGURATION_BLOCKED";
    requiresOperator = true;
    notes.push("n8n receipt is blocked because a controlled receiver or redacted proof is missing.");
  } else if (receipt.deliveryState !== "DELIVERED_TO_AUTOMATION") {
    linkageState = "N8N_NOT_COMPLETE";
    requiresOperator = receipt.deliveryState === "FINAL_FAILURE";
    notes.push("n8n execution did not complete successfully yet.");
  } else {
    notes.push("Webhook event and n8n execution receipt are linked by redacted event/execution identifiers.");
  }

  return {
    eventId: webhook.eventId,
    workflowId: receipt.workflowId,
    executionId: receipt.executionId,
    webhookOutcome: webhook.outcome,
    n8nDeliveryState: receipt.deliveryState,
    linkageState,
    requiresOperator,
    evidenceVerification: receipt.evidence.verification,
    businessMutationAllowed: false,
    notes,
  };
}
