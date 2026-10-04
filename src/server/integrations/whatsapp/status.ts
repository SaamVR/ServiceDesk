export type WhatsAppDeliveryLifecycleState = "PENDING" | "PROVIDER_ACCEPTED" | "DELIVERED" | "READ" | "FAILED";
export type WhatsAppDeliveryTransitionResult = "APPLIED" | "DUPLICATE" | "STALE_REGRESSION";

export interface WhatsAppDeliveryTransition {
  result: WhatsAppDeliveryTransitionResult;
  state: WhatsAppDeliveryLifecycleState;
}

const PROGRESS_RANK: Record<Exclude<WhatsAppDeliveryLifecycleState, "FAILED">, number> = {
  PENDING: 0,
  PROVIDER_ACCEPTED: 1,
  DELIVERED: 2,
  READ: 3,
};

function isProgressState(state: WhatsAppDeliveryLifecycleState): state is Exclude<WhatsAppDeliveryLifecycleState, "FAILED"> {
  return state !== "FAILED";
}

export function applyWhatsAppDeliveryTransition(
  current: WhatsAppDeliveryLifecycleState,
  next: WhatsAppDeliveryLifecycleState,
): WhatsAppDeliveryTransition {
  if (current === next) {
    return { result: "DUPLICATE", state: current };
  }

  if (next === "FAILED") {
    if (current === "PENDING" || current === "PROVIDER_ACCEPTED") {
      return { result: "APPLIED", state: "FAILED" };
    }
    return { result: "STALE_REGRESSION", state: current };
  }

  if (current === "FAILED") {
    return { result: "STALE_REGRESSION", state: current };
  }

  if (isProgressState(current) && PROGRESS_RANK[next] > PROGRESS_RANK[current]) {
    return { result: "APPLIED", state: next };
  }

  return { result: "STALE_REGRESSION", state: current };
}
