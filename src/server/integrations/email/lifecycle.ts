export type EmailDeliveryState = "ACCEPTED" | "DELIVERED" | "RETRYABLE_FAILURE" | "FAILED";
export type EmailCallbackLifecycleResult = "APPLIED" | "DUPLICATE" | "OUT_OF_ORDER_IGNORED" | "SUPPRESSION_REVIEW";

export interface EmailCallbackLifecycleSnapshot {
  providerMessageId: string;
  callbackKey: string;
  deliveryState: EmailDeliveryState;
  occurredAt: string;
  suppressionRequired?: boolean;
}

export interface EmailCallbackLifecycleEvent {
  callbackKey: string;
  providerMessageId: string;
  eventType: "DELIVERED" | "BOUNCE" | "COMPLAINT";
  occurredAt: string;
  bounceType?: "hard" | "soft" | "unknown";
}

export interface EmailCallbackLifecycleDecision {
  result: EmailCallbackLifecycleResult;
  next: EmailCallbackLifecycleSnapshot;
  mutatesBusinessTruth: false;
}

export interface EmailCallbackSummaryInput {
  providerMessageId: string;
  recipientRef: string;
  eventType: "DELIVERED" | "BOUNCE" | "COMPLAINT";
  bounceType?: "hard" | "soft" | "unknown";
  reason?: string;
}

export interface EmailCallbackSummary {
  providerMessageRef: string;
  recipientRef: string;
  eventType: "DELIVERED" | "BOUNCE" | "COMPLAINT";
  bounceType?: "hard" | "soft" | "unknown";
  reasonCategory?: "REDACTED_PROVIDER_REASON";
  mutatesBusinessTruth: false;
}

function timestamp(value: string): number {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function deliveryStateFor(event: EmailCallbackLifecycleEvent): EmailDeliveryState {
  if (event.eventType === "DELIVERED") return "DELIVERED";
  if (event.eventType === "BOUNCE" && event.bounceType === "soft") return "RETRYABLE_FAILURE";
  return "FAILED";
}

function redactedMessageRef(value: string): string {
  if (value.length <= 8) return "redacted";
  return `${value.slice(0, 3)}…${value.slice(-4)}`;
}

export function applyEmailCallbackLifecycle(
  current: EmailCallbackLifecycleSnapshot | undefined,
  event: EmailCallbackLifecycleEvent,
): EmailCallbackLifecycleDecision {
  if (current && current.callbackKey === event.callbackKey) {
    return { result: "DUPLICATE", next: current, mutatesBusinessTruth: false };
  }

  if (current) {
    // The lifecycle is keyed to one outbound provider message. A callback
    // for another provider message can never inherit this one's proof.
    // Invalid and older event timestamps cannot replace a newer snapshot.
    const incomingAt = timestamp(event.occurredAt);
    const savedAt = timestamp(current.occurredAt);
    if (event.providerMessageId !== current.providerMessageId ||
        !Number.isFinite(incomingAt) || !Number.isFinite(savedAt) ||
        incomingAt < savedAt) {
      return { result: "OUT_OF_ORDER_IGNORED", next: current, mutatesBusinessTruth: false };
    }
    if (current.deliveryState === "DELIVERED") {
      // A later complaint or hard bounce is a suppression risk requiring
      // review, not permission to erase an independently verified delivery.
      if (event.eventType === "COMPLAINT" ||
          (event.eventType === "BOUNCE" && event.bounceType !== "soft")) {
        return {
          result: "SUPPRESSION_REVIEW",
          next: { ...current, callbackKey: event.callbackKey, suppressionRequired: true },
          mutatesBusinessTruth: false,
        };
      }
      return { result: "OUT_OF_ORDER_IGNORED", next: current, mutatesBusinessTruth: false };
    }
  }

  return {
    result: "APPLIED",
    next: {
      providerMessageId: event.providerMessageId,
      callbackKey: event.callbackKey,
      deliveryState: deliveryStateFor(event),
      occurredAt: event.occurredAt,
      suppressionRequired: event.eventType === "COMPLAINT" || (event.eventType === "BOUNCE" && event.bounceType !== "soft"),
    },
    mutatesBusinessTruth: false,
  };
}

export function summarizeEmailCallback(input: EmailCallbackSummaryInput): EmailCallbackSummary {
  return {
    providerMessageRef: redactedMessageRef(input.providerMessageId),
    recipientRef: input.recipientRef,
    eventType: input.eventType,
    bounceType: input.bounceType,
    reasonCategory: input.reason ? "REDACTED_PROVIDER_REASON" : undefined,
    mutatesBusinessTruth: false,
  };
}
