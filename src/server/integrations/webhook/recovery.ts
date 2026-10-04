import { classifyProviderRecovery, type ProviderRecoveryDecision, type ProviderRecoveryEvent } from "../recovery/policy";
import type { WebhookExecutionResult } from "./executor";

function statusFor(result: WebhookExecutionResult): ProviderRecoveryEvent["status"] {
  if (result.outcome === "DELIVERED") return "DUPLICATE";
  if (result.retryable) return "TRANSIENT_FAILURE";
  if (result.reason === "MAX_ATTEMPTS_EXHAUSTED") return "TRANSIENT_FAILURE";
  if (result.reason === "DESTINATION_NOT_ALLOWED") return "CONFIGURATION_BLOCKED";
  return "PERMANENT_FAILURE";
}

export function buildWebhookRecoveryEvent(result: WebhookExecutionResult, occurredAt: string): ProviderRecoveryEvent {
  return {
    provider: "WEBHOOK",
    operation: "DELIVERY",
    status: statusFor(result),
    attempts: result.attempt,
    maxAttempts: result.maxAttempts,
    occurredAt,
    idempotencyKey: result.eventId,
    redactedTarget: result.endpointHost ?? "redacted-webhook-destination",
  };
}

export function decideWebhookRecovery(event: ProviderRecoveryEvent): ProviderRecoveryDecision {
  return classifyProviderRecovery(event);
}
