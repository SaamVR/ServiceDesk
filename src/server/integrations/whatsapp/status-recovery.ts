export type WhatsAppStatusRecoveryOutcome = "PERSISTENCE_RETRYABLE_FAILURE" | "PERMANENT_DELIVERY_FAILURE";

export interface WhatsAppStatusRecoveryInput {
  workspaceId: string;
  providerMessageId: string;
  outcome: WhatsAppStatusRecoveryOutcome;
  occurredAt: string;
  detail: string;
}

export interface WhatsAppStatusRecoveryRecord {
  workspaceId: string;
  provider: "WHATSAPP";
  queue: "provider-retry" | "provider-operator-review";
  action: "RETRY" | "OPERATOR_REVIEW";
  idempotencyKey: string;
  occurredAt: string;
  mutatesBusinessTruth: false;
  operatorVisible: boolean;
  notes: string[];
}

export function bridgeWhatsAppStatusOutcomeToRecovery(input: WhatsAppStatusRecoveryInput): WhatsAppStatusRecoveryRecord {
  if (input.outcome === "PERSISTENCE_RETRYABLE_FAILURE") {
    return {
      workspaceId: input.workspaceId,
      provider: "WHATSAPP",
      queue: "provider-retry",
      action: "RETRY",
      idempotencyKey: `${input.workspaceId}:whatsapp-status:${input.providerMessageId}:retry`,
      occurredAt: input.occurredAt,
      mutatesBusinessTruth: false,
      operatorVisible: false,
      notes: [`Retry signed WhatsApp status callback after transient persistence failure: ${input.detail}`],
    };
  }

  return {
    workspaceId: input.workspaceId,
    provider: "WHATSAPP",
    queue: "provider-operator-review",
    action: "OPERATOR_REVIEW",
    idempotencyKey: `${input.workspaceId}:whatsapp-status:${input.providerMessageId}:operator-review`,
    occurredAt: input.occurredAt,
    mutatesBusinessTruth: false,
    operatorVisible: true,
    notes: [`Permanent WhatsApp delivery failure needs operator review: ${input.detail}`],
  };
}
