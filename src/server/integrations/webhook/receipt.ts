export type WebhookDeliveryReceiptMergeResult = "INSERTED" | "UPDATED" | "DUPLICATE_DELIVERED";
export type WebhookReceiptOutcome = "DELIVERED" | "RETRY" | "FAILED_FINAL";

export interface WebhookDeliveryReceiptKeyInput {
  workspaceId: string;
  endpointId: string;
  eventId: string;
}

export interface WebhookDeliveryReceiptUpdate extends WebhookDeliveryReceiptKeyInput {
  attempt: number;
  outcome: WebhookReceiptOutcome;
  capturedAt: string;
  endpointHost: string;
  nextAttemptAt?: string;
}

export interface WebhookDeliveryReceipt extends WebhookDeliveryReceiptKeyInput {
  receiptKey: string;
  attempts: number;
  delivered: boolean;
  finalFailure: boolean;
  firstCapturedAt: string;
  lastCapturedAt: string;
  endpointHost: string;
  nextAttemptAt?: string;
  businessMutationAllowed: false;
}

export interface WebhookDeliveryReceiptMergeDecision {
  result: WebhookDeliveryReceiptMergeResult;
  receipt: WebhookDeliveryReceipt;
}

export function webhookDeliveryReceiptKey(input: WebhookDeliveryReceiptKeyInput): string {
  return `webhook:${input.workspaceId}:${input.endpointId}:${input.eventId}`;
}

function receiptFrom(update: WebhookDeliveryReceiptUpdate): WebhookDeliveryReceipt {
  return {
    workspaceId: update.workspaceId,
    endpointId: update.endpointId,
    eventId: update.eventId,
    receiptKey: webhookDeliveryReceiptKey(update),
    attempts: update.attempt,
    delivered: update.outcome === "DELIVERED",
    finalFailure: update.outcome === "FAILED_FINAL",
    firstCapturedAt: update.capturedAt,
    lastCapturedAt: update.capturedAt,
    endpointHost: update.endpointHost,
    nextAttemptAt: update.outcome === "RETRY" ? update.nextAttemptAt : undefined,
    businessMutationAllowed: false,
  };
}

export function mergeWebhookDeliveryReceipt(
  current: WebhookDeliveryReceipt | undefined,
  update: WebhookDeliveryReceiptUpdate,
): WebhookDeliveryReceiptMergeDecision {
  if (!current) return { result: "INSERTED", receipt: receiptFrom(update) };

  if (current.delivered) return { result: "DUPLICATE_DELIVERED", receipt: current };

  return {
    result: "UPDATED",
    receipt: {
      ...current,
      attempts: update.attempt,
      delivered: update.outcome === "DELIVERED",
      finalFailure: update.outcome === "FAILED_FINAL",
      lastCapturedAt: update.capturedAt,
      endpointHost: update.endpointHost,
      nextAttemptAt: update.outcome === "RETRY" ? update.nextAttemptAt : undefined,
      businessMutationAllowed: false,
    },
  };
}
