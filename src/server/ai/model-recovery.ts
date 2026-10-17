import { createHash } from "node:crypto";
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
  // A recovery receipt can reach logs and operator queues. Never preserve a
  // raw conversation or tenant identifier (potentially a customer address,
  // prompt fragment, token or provider payload) inside those records.
  // Invalid clocks/budgets must not throw through a retry worker.
  const safeId=(value:unknown)=>typeof value==="string" &&
    /^[A-Za-z0-9:_-]{3,128}$/.test(value);
  const timeOk=typeof input?.occurredAt==="string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(input.occurredAt) &&
    Number.isFinite(Date.parse(input.occurredAt));
  const attemptsOk=Number.isSafeInteger(input?.attempts) &&
    input.attempts>=0 && input.attempts<=12 &&
    Number.isSafeInteger(input.maxAttempts) &&
    input.maxAttempts>=1 && input.maxAttempts<=12 &&
    input.attempts<input.maxAttempts;
  if (!input || !safeId(input.workspaceId) || !safeId(input.conversationId) ||
      !timeOk || !attemptsOk) return {
    provider:"AI",operation:"CALLBACK_APPLY",action:"OPERATOR_REVIEW",
    retryable:false,terminal:true,preservesIdempotency:false,
    mutatesBusinessTruth:false,
    notes:["AI recovery context is invalid; verify redacted source evidence before retry."],
  };
  const evidenceId=createHash("sha256")
    .update(input.workspaceId+"|"+input.conversationId).digest("hex").slice(0,24);
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
        `conversationRef=${evidenceId}`,
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
    idempotencyKey: `ai:${evidenceId}`,
    redactedTarget: `conversationRef:${evidenceId}`,
  });
}
