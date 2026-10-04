import { decideWhatsAppStatusTransition, type WhatsAppDeliverySnapshot, type WhatsAppDeliveryState } from "./status-transition";

export type WhatsAppDeliveryLifecycleState = "PENDING" | WhatsAppDeliveryState;
export type WhatsAppDeliveryTransitionResult = "APPLIED" | "DUPLICATE" | "STALE_REGRESSION";

export type WhatsAppDeliveryTransitionReason =
  | "FIRST_STATUS"
  | "FORWARD_PROGRESS"
  | "FAILURE_BEFORE_CONFIRMED_DELIVERY"
  | "SAME_STATE"
  | "SAME_CALLBACK_KEY"
  | "SAME_STATE_AND_TIMESTAMP"
  | "OLDER_PROVIDER_TIMESTAMP"
  | "LOWER_ORDER_STATE"
  | "FAILED_AFTER_CONFIRMED_DELIVERY";

export interface WhatsAppDeliveryTransition {
  result: WhatsAppDeliveryTransitionResult;
  state: WhatsAppDeliveryLifecycleState;
  reason: WhatsAppDeliveryTransitionReason;
}

function snapshotFor(state: Exclude<WhatsAppDeliveryLifecycleState, "PENDING">): WhatsAppDeliverySnapshot {
  return {
    deliveryState: state,
    providerTimestamp: "0",
    callbackKey: `canonical:${state}:0`,
  };
}

function resultName(result: ReturnType<typeof decideWhatsAppStatusTransition>["result"]): WhatsAppDeliveryTransitionResult {
  return result === "APPLY" ? "APPLIED" : result;
}

export function applyWhatsAppDeliveryTransition(
  current: WhatsAppDeliveryLifecycleState,
  next: WhatsAppDeliveryLifecycleState,
): WhatsAppDeliveryTransition {
  if (current === next) {
    return { result: "DUPLICATE", state: current, reason: "SAME_STATE" };
  }

  if (next === "PENDING") {
    return { result: "STALE_REGRESSION", state: current, reason: "LOWER_ORDER_STATE" };
  }

  const decision = decideWhatsAppStatusTransition(current === "PENDING" ? undefined : snapshotFor(current), snapshotFor(next));

  return {
    result: resultName(decision.result),
    state: decision.nextState,
    reason: decision.reason,
  };
}

export { decideWhatsAppStatusTransition, type WhatsAppDeliverySnapshot, type WhatsAppDeliveryState } from "./status-transition";
