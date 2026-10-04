import { classifyProviderRecovery, type ProviderRecoveryDecision, type ProviderRecoveryEvent } from "../integrations/recovery/policy";

export interface AiModelFailureRecoveryInput {
  code: string;
  workspaceId: string;
  conversationId: string;
  attempts: number;
  maxAttempts: number;
  occurredAt: string;
}

function statusFor(code: string): ProviderRecoveryEvent["status"] {
  if (code === "AI_MODEL_CONFIGURATION_BLOCKED") return "CONFIGURATION_BLOCKED";
  if (code === "AI_MODEL_INVALID_RESPONSE" || code === "AI_OUTPUT_INVALID") return "PERMANENT_FAILURE";
  if (code === "AI_MODEL_TIMEOUT" || code === "AI_MODEL_RATE_LIMITED" || code === "AI_MODEL_TRANSIENT_FAILURE" || code === "AI_MODEL_NETWORK_FAILURE") return "TRANSIENT_FAILURE";
  return "PERMANENT_FAILURE";
}

export function classifyAiModelFailureForRecovery(input: AiModelFailureRecoveryInput): ProviderRecoveryDecision {
  const status = statusFor(input.code);
  if (status === "PERMANENT_FAILURE" && (input.code === "AI_MODEL_INVALID_RESPONSE" || input.code === "AI_OUTPUT_INVALID")) {
    return {
      provider: "AI",
      operation: "CALLBACK_APPLY",
      action: "OPERATOR_REVIEW",
      retryable: false,
      terminal: true,
      preservesIdempotency: true,
      mutatesBusinessTruth: false,
      notes: [
        "AI model output failed schema or safety validation; route to human review instead of retrying unsafe output.",
        `conversation=${input.conversationId}`,
      ],
    };
  }

  return classifyProviderRecovery({
    provider: "AI",
    operation: "CALLBACK_APPLY",
    status,
    attempts: input.attempts,
    maxAttempts: input.maxAttempts,
    occurredAt: input.occurredAt,
    idempotencyKey: `ai:${input.workspaceId}:${input.conversationId}`,
    redactedTarget: `conversation:${input.conversationId}`,
  });
}
