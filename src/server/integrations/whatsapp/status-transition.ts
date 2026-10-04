export type WhatsAppDeliveryState = "PROVIDER_ACCEPTED" | "DELIVERED" | "READ" | "FAILED";

export interface WhatsAppDeliverySnapshot {
  deliveryState: WhatsAppDeliveryState;
  providerTimestamp: string;
  callbackKey: string;
}

export type WhatsAppStatusTransitionDecision =
  | { result: "APPLY"; nextState: WhatsAppDeliveryState; reason: "FIRST_STATUS" | "FORWARD_PROGRESS" | "FAILURE_BEFORE_CONFIRMED_DELIVERY" }
  | { result: "DUPLICATE"; nextState: WhatsAppDeliveryState; reason: "SAME_CALLBACK_KEY" | "SAME_STATE_AND_TIMESTAMP" }
  | { result: "STALE_REGRESSION"; nextState: WhatsAppDeliveryState; reason: "OLDER_PROVIDER_TIMESTAMP" | "LOWER_ORDER_STATE" | "FAILED_AFTER_CONFIRMED_DELIVERY" | "STATUS_AFTER_TERMINAL_FAILURE" };

const deliveryOrder: Record<WhatsAppDeliveryState, number> = {
  FAILED: 0,
  PROVIDER_ACCEPTED: 1,
  DELIVERED: 2,
  READ: 3,
};

function numericTimestamp(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : new Date(value).getTime();
}

export function decideWhatsAppStatusTransition(
  current: WhatsAppDeliverySnapshot | undefined,
  incoming: WhatsAppDeliverySnapshot,
): WhatsAppStatusTransitionDecision {
  if (!current) {
    return { result: "APPLY", nextState: incoming.deliveryState, reason: "FIRST_STATUS" };
  }

  if (current.callbackKey === incoming.callbackKey) {
    return { result: "DUPLICATE", nextState: current.deliveryState, reason: "SAME_CALLBACK_KEY" };
  }

  if (current.deliveryState === incoming.deliveryState && current.providerTimestamp === incoming.providerTimestamp) {
    return { result: "DUPLICATE", nextState: current.deliveryState, reason: "SAME_STATE_AND_TIMESTAMP" };
  }

  const currentTimestamp = numericTimestamp(current.providerTimestamp);
  const incomingTimestamp = numericTimestamp(incoming.providerTimestamp);
  if (Number.isFinite(currentTimestamp) && Number.isFinite(incomingTimestamp) && incomingTimestamp < currentTimestamp) {
    return { result: "STALE_REGRESSION", nextState: current.deliveryState, reason: "OLDER_PROVIDER_TIMESTAMP" };
  }

  if (current.deliveryState === "FAILED" && incoming.deliveryState !== "FAILED") {
    return { result: "STALE_REGRESSION", nextState: "FAILED", reason: "STATUS_AFTER_TERMINAL_FAILURE" };
  }

  if (incoming.deliveryState === "FAILED") {
    if (current.deliveryState === "DELIVERED" || current.deliveryState === "READ") {
      return { result: "STALE_REGRESSION", nextState: current.deliveryState, reason: "FAILED_AFTER_CONFIRMED_DELIVERY" };
    }
    return { result: "APPLY", nextState: "FAILED", reason: "FAILURE_BEFORE_CONFIRMED_DELIVERY" };
  }

  if (deliveryOrder[incoming.deliveryState] < deliveryOrder[current.deliveryState]) {
    return { result: "STALE_REGRESSION", nextState: current.deliveryState, reason: "LOWER_ORDER_STATE" };
  }

  return { result: "APPLY", nextState: incoming.deliveryState, reason: "FORWARD_PROGRESS" };
}
