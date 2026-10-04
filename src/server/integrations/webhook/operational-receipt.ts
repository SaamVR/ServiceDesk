import type { RedactedProviderEvidence } from "../types";

export type WebhookOperationalDeliveryState = "DELIVERED" | "RETRYABLE_FAILURE" | "FINAL_FAILURE" | "N8N_PENDING";
export type WebhookOperationalAction = "ACK_DELIVERED" | "E04_RETRY" | "ATTENTION_REVIEW" | "WAIT_FOR_N8N_COMPLETION";

export interface WebhookOperationalReceiptInput {
  receiptKey: string;
  endpointId: string;
  workflowId?: string;
  providerMessageId: string;
  status: number;
  occurredAt: string;
  responseExcerpt?: string;
  n8nExecutionId?: string;
  n8nState?: "PENDING" | "SUCCESS" | "FAILED";
}

export interface WebhookOperationalReceipt {
  receiptKey: string;
  endpointId: string;
  workflowId?: string;
  providerMessageId: string;
  state: WebhookOperationalDeliveryState;
  action: WebhookOperationalAction;
  terminal: boolean;
  idempotencyKey: string;
  redactedResponseEvidence: RedactedProviderEvidence;
}

function redact(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+\/=-]+/gi, "Bearer [redacted]")
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[redacted-email]")
    .replace(/\+?\d{8,15}/g, "[redacted-phone]")
    .replace(/token["']?\s*[:=]\s*["']?[^"'\s,}&]+/gi, "token:[redacted]")
    .slice(0, 180);
}

function stateFor(input: WebhookOperationalReceiptInput): Pick<WebhookOperationalReceipt, "state" | "action" | "terminal"> {
  if (input.n8nState === "PENDING") return { state: "N8N_PENDING", action: "WAIT_FOR_N8N_COMPLETION", terminal: false };
  if (input.status >= 200 && input.status < 300 && input.n8nState !== "PENDING") return { state: "DELIVERED", action: "ACK_DELIVERED", terminal: true };
  if (input.status === 408 || input.status === 409 || input.status === 425 || input.status === 429 || input.status >= 500) {
    return { state: "RETRYABLE_FAILURE", action: "E04_RETRY", terminal: false };
  }
  return { state: "FINAL_FAILURE", action: "ATTENTION_REVIEW", terminal: true };
}

export function buildWebhookOperationalReceipt(input: WebhookOperationalReceiptInput): WebhookOperationalReceipt {
  const classification = stateFor(input);
  const redacted = redact(input.responseExcerpt);
  return {
    receiptKey: input.receiptKey,
    endpointId: input.endpointId,
    workflowId: input.workflowId,
    providerMessageId: input.providerMessageId,
    idempotencyKey: `${input.endpointId}:${input.providerMessageId}:${input.receiptKey}`,
    ...classification,
    redactedResponseEvidence: {
      provider: "WEBHOOK",
      mode: "SANDBOX",
      verification: "CONTRACT_TESTED",
      capturedAt: input.occurredAt,
      controlledId: input.providerMessageId,
      redactedReceipt: redacted,
      notes: [
        "Webhook response evidence is redacted; raw response and secrets are not stored.",
        input.n8nState === "PENDING" ? "n8n pending completion is explicit and is not treated as delivered." : "Webhook receipt classified for E04-owned retry/recovery.",
      ],
    },
  };
}
