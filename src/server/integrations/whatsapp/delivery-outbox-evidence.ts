import type { DeliveryState } from "./delivery-triage";

export type DeliveryEvidenceSource =
  | "MESSAGE_STATE" | "OUTBOX_PROVIDER_ACCEPTANCE" | "OUTBOX_TERMINAL"
  | "UNVERIFIED";
export interface DeliveryOutboxEvidence {
  id: string;
  workspace_id: string;
  topic: string;
  status: string;
  provider_reference: string | null;
}
export interface ReconciledDelivery {
  deliveryState: DeliveryState;
  evidenceSource: DeliveryEvidenceSource;
  reason?: "OUTBOX_FAILED" | "OUTBOX_SUPPRESSED" | "OUTBOX_RECEIPT_MISSING" | "OUTBOX_REFERENCE_MISSING";
}
const callbackStates = new Set<DeliveryState>(["DELIVERED", "READ", "FAILED", "SUPPRESSED"]);

/**
 * Reconciles already-durable outbox truth into a READ-ONLY operational view.
 * The message row must never be mutated by this function. SENT + a provider
 * reference proves provider acceptance, NOT customer delivery/read.
 *
 * Never mistake a missing event/reference for provider acceptance.
 */
export function reconcileOutboundDelivery(
  messageState: DeliveryState,
  event: DeliveryOutboxEvidence | undefined,
): ReconciledDelivery {
  if (callbackStates.has(messageState)) {
    return { deliveryState: messageState, evidenceSource: "MESSAGE_STATE" };
  }
  if (!event) {
    return messageState === "QUEUED" || messageState === "RUNNING"
      ? { deliveryState: "UNKNOWN", evidenceSource: "UNVERIFIED",
          reason: "OUTBOX_RECEIPT_MISSING" }
      : { deliveryState: messageState, evidenceSource: "MESSAGE_STATE" };
  }
  if (event.status === "FAILED") {
    return { deliveryState: "FAILED", evidenceSource: "OUTBOX_TERMINAL", reason: "OUTBOX_FAILED" };
  }
  if (event.status === "SUPPRESSED") {
    return { deliveryState: "SUPPRESSED", evidenceSource: "OUTBOX_TERMINAL",
      reason: "OUTBOX_SUPPRESSED" };
  }
  if (event.status === "SENT") {
    if (typeof event.provider_reference === "string" && event.provider_reference.trim()) {
      return { deliveryState: "PROVIDER_ACCEPTED", evidenceSource: "OUTBOX_PROVIDER_ACCEPTANCE" };
    }
    return { deliveryState: "UNKNOWN", evidenceSource: "UNVERIFIED",
      reason: "OUTBOX_REFERENCE_MISSING" };
  }
  if (event.status === "PENDING") {
    return { deliveryState: messageState, evidenceSource: "MESSAGE_STATE" };
  }
  return { deliveryState: "UNKNOWN", evidenceSource: "UNVERIFIED",
    reason: "OUTBOX_RECEIPT_MISSING" };
}
