import { classifyProviderRecovery, type ProviderRecoveryDecision } from "../recovery/policy";
import type { EmailProviderEventType, EmailSuppressionAction } from "../../api-handlers/provider-email";

export type EmailCallbackPolicyReason = "DELIVERED" | "HARD_BOUNCE" | "TEMPORARY_BOUNCE" | "UNKNOWN_BOUNCE" | "COMPLAINT";

export interface EmailCallbackPolicyInput {
  eventType: EmailProviderEventType;
  bounceType?: "hard" | "soft" | "unknown";
}

export interface EmailCallbackPolicyDecision {
  suppressionAction: EmailSuppressionAction;
  retryable: boolean;
  reason: EmailCallbackPolicyReason;
}

export function classifyEmailCallbackPolicy(input: EmailCallbackPolicyInput): EmailCallbackPolicyDecision {
  if (input.eventType === "DELIVERED") {
    return { suppressionAction: "NONE", retryable: false, reason: "DELIVERED" };
  }

  if (input.eventType === "COMPLAINT") {
    return { suppressionAction: "SUPPRESS_RECIPIENT", retryable: false, reason: "COMPLAINT" };
  }

  if (input.bounceType === "soft") {
    return { suppressionAction: "NONE", retryable: true, reason: "TEMPORARY_BOUNCE" };
  }

  if (input.bounceType === "unknown") {
    return { suppressionAction: "SUPPRESS_RECIPIENT", retryable: false, reason: "UNKNOWN_BOUNCE" };
  }

  return { suppressionAction: "SUPPRESS_RECIPIENT", retryable: false, reason: "HARD_BOUNCE" };
}

export function mapEmailProviderSendFailure(code: string, attempts: number, maxAttempts: number, occurredAt: string): ProviderRecoveryDecision {
  const status = code === "EMAIL_RATE_LIMITED" || code === "EMAIL_TRANSIENT_FAILURE" || code === "EMAIL_TIMEOUT" || code === "EMAIL_NETWORK_FAILURE"
    ? "TRANSIENT_FAILURE"
    : code === "EMAIL_CONFIGURATION_BLOCKED"
      ? "CONFIGURATION_BLOCKED"
      : "PERMANENT_FAILURE";

  return classifyProviderRecovery({
    provider: "EMAIL",
    operation: "OUTBOUND_SEND",
    status,
    attempts,
    maxAttempts,
    occurredAt,
    idempotencyKey: `email-recovery:${code}:${attempts}`,
    redactedTarget: "email-recipient:redacted",
  });
}
