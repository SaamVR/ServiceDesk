export type UnifiedProviderDeliveryState = "ACCEPTED" | "DELIVERED" | "RETRYABLE_FAILURE" | "FAILED";

export interface UnifiedProviderDeliverySemantics {
  state: UnifiedProviderDeliveryState;
  deliveryProof: boolean;
  failure: boolean;
  businessMutationAllowed: false;
  notes: string[];
}

export interface EmailDeliverySemanticsInput {
  eventType: "DELIVERED" | "BOUNCE" | "COMPLAINT";
  bounceType?: "hard" | "soft" | "unknown";
}

export interface WebhookDeliverySemanticsInput {
  outcome: "DELIVERED" | "RETRY" | "FAILED_FINAL";
  retryable: boolean;
}

export interface N8nDeliverySemanticsInput {
  deliveryState:
    | "DELIVERED_TO_AUTOMATION"
    | "PENDING_AUTOMATION_COMPLETION"
    | "RETRYABLE_FAILURE"
    | "FINAL_FAILURE"
    | "CONFIGURATION_BLOCKED";
}

function semantics(
  state: UnifiedProviderDeliveryState,
  deliveryProof: boolean,
  failure: boolean,
  notes: string[],
): UnifiedProviderDeliverySemantics {
  return {
    state,
    deliveryProof,
    failure,
    businessMutationAllowed: false,
    notes,
  };
}

export function mapEmailCallbackToDeliveryState(input: EmailDeliverySemanticsInput): UnifiedProviderDeliverySemantics {
  if (input.eventType === "DELIVERED") {
    return semantics("DELIVERED", true, false, ["Email provider delivered callback is delivery proof for the email only."]);
  }

  if (input.eventType === "BOUNCE" && input.bounceType === "soft") {
    return semantics("RETRYABLE_FAILURE", false, true, ["Soft bounce is retryable and is not delivery proof."]);
  }

  return semantics("FAILED", false, true, ["Hard bounce, unknown bounce, or complaint is terminal for this email delivery attempt."]);
}

export function mapWebhookExecutionToDeliveryState(input: WebhookDeliverySemanticsInput): UnifiedProviderDeliverySemantics {
  if (input.outcome === "DELIVERED") {
    return semantics("DELIVERED", true, false, ["Webhook receiver accepted the signed event; no ServiceDesk business truth may be mutated from that alone."]);
  }

  if (input.outcome === "RETRY" || input.retryable) {
    return semantics("RETRYABLE_FAILURE", false, true, ["Webhook delivery failed transiently and should retry with the same event identity."]);
  }

  return semantics("FAILED", false, true, ["Webhook delivery reached a terminal failure state."]);
}

export function mapN8nReceiptToDeliveryState(input: N8nDeliverySemanticsInput): UnifiedProviderDeliverySemantics {
  if (input.deliveryState === "DELIVERED_TO_AUTOMATION") {
    return semantics("DELIVERED", true, false, ["n8n accepted/completed automation delivery; this is not booking or payment truth."]);
  }

  if (input.deliveryState === "PENDING_AUTOMATION_COMPLETION") {
    return semantics("ACCEPTED", false, false, ["n8n execution is still running; delivery proof is not final."]);
  }

  if (input.deliveryState === "RETRYABLE_FAILURE") {
    return semantics("RETRYABLE_FAILURE", false, true, ["n8n execution failed with a retryable condition."]);
  }

  return semantics("FAILED", false, true, ["n8n execution is terminal or blocked."]);
}
