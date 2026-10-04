import { classifyProviderRecovery, type ProviderRecoveryDecision, type ProviderRecoveryEvent } from "../recovery/policy";
import type { N8nDeliveryState } from "./execution";
import { n8nReceiptKey } from "./receipt";

export interface N8nRecoveryEventInput {
  workspaceId: string;
  workflowId: string;
  executionId: string;
  triggeredEventId: string;
  deliveryState: N8nDeliveryState;
  attempts: number;
  maxAttempts: number;
  occurredAt: string;
}

function statusFor(deliveryState: N8nDeliveryState): ProviderRecoveryEvent["status"] {
  if (deliveryState === "RETRYABLE_FAILURE") return "TRANSIENT_FAILURE";
  if (deliveryState === "CONFIGURATION_BLOCKED") return "CONFIGURATION_BLOCKED";
  if (deliveryState === "FINAL_FAILURE") return "PERMANENT_FAILURE";
  if (deliveryState === "PENDING_AUTOMATION_COMPLETION") return "STALE_STATE";
  return "DUPLICATE";
}

export function buildN8nRecoveryEvent(input: N8nRecoveryEventInput): ProviderRecoveryEvent {
  return {
    provider: "WEBHOOK",
    operation: "DELIVERY",
    status: statusFor(input.deliveryState),
    attempts: input.attempts,
    maxAttempts: input.maxAttempts,
    occurredAt: input.occurredAt,
    idempotencyKey: n8nReceiptKey(input),
    redactedTarget: `n8n:${input.workflowId}:${input.executionId}`,
  };
}

export function decideN8nRecovery(event: ProviderRecoveryEvent): ProviderRecoveryDecision {
  return classifyProviderRecovery(event);
}
