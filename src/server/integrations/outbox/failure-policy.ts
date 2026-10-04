import type { OutboxJob, RedactedProviderEvidence } from "../types";
import { dispatchOutcomeBase, type CommittedOutboxDispatchFailure } from "./dispatch-port";

export interface ProviderFailureInput {
  job: OutboxJob;
  code?: string;
  message?: string;
  retryAfterSeconds?: number;
  evidence?: RedactedProviderEvidence;
}

const retryableCodes = new Set([
  "TIMEOUT",
  "NETWORK_ERROR",
  "CONNECTION_RESET",
  "ECONNRESET",
  "RATE_LIMITED",
  "TOO_MANY_REQUESTS",
  "TRANSIENT_PROVIDER_ERROR",
  "PROVIDER_TEMPORARILY_UNAVAILABLE",
  "WEBHOOK_DELIVERY_RETRYABLE",
]);

const suppressedCodes = new Set([
  "RECIPIENT_OPTED_OUT",
  "MISSING_OPT_IN",
  "QUIET_HOURS",
  "HUMAN_HANDOVER_ACTIVE",
  "SUPPRESSED",
]);

const terminalCodes = new Set([
  "INVALID_REQUEST",
  "INVALID_RECIPIENT",
  "AUTHENTICATION_FAILED",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "CONFIGURATION_MISSING",
  "CONFIGURATION_INVALID",
  "TEMPLATE_REQUIRED",
  "TEMPLATE_NOT_APPROVED",
  "UNSUPPORTED_CHANNEL",
  "UNSUPPORTED_DISPATCH_CHANNEL",
  "WORKSPACE_MISMATCH",
  "CHANNEL_MISMATCH",
]);

function normalizeCode(code: string | undefined): string {
  return (code && code.trim() ? code.trim().toUpperCase() : "UNKNOWN_PROVIDER_FAILURE");
}

function redactSensitive(value: string): string {
  return value
    .replace(/\\bBearer\\s+[A-Za-z0-9._~+\\/=-]+/gi, "Bearer [redacted]")
    .replace(/access_token=[^\\s&]+/gi, "access_token=[redacted]")
    .replace(/token["']?\\s*[:=]\\s*["']?[^"'\\s,}&]+/gi, "token:[redacted]")
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}/g, "[redacted-email]")
    .replace(/\\+?\\d{8,15}/g, "[redacted-phone]");
}

function redactedMessage(input: ProviderFailureInput, normalizedCode: string): string {
  const source = input.message?.trim();
  if (!source) return normalizedCode;
  const collapsed = redactSensitive(source).replace(/\\s+/g, " ");
  return collapsed.length > 180 ? `${collapsed.slice(0, 177)}...` : collapsed;
}

export function classifyProviderFailure(input: ProviderFailureInput): CommittedOutboxDispatchFailure {
  const code = normalizeCode(input.code);
  const base = dispatchOutcomeBase(input.job);
  const message = redactedMessage(input, code);

  if (suppressedCodes.has(code)) {
    return { ...base, outcome: "SUPPRESSED", code, message, evidence: input.evidence };
  }

  if (retryableCodes.has(code)) {
    return {
      ...base,
      outcome: "RETRYABLE_FAILURE",
      code,
      message,
      retryAfterSeconds: input.retryAfterSeconds,
      evidence: input.evidence,
    };
  }

  if (terminalCodes.has(code)) {
    return { ...base, outcome: "TERMINAL_FAILURE", code, message, evidence: input.evidence };
  }

  return { ...base, outcome: "TERMINAL_FAILURE", code, message: "Unknown provider failure failed closed.", evidence: input.evidence };
}
