import type { MessageDeliveryState } from "@/contracts";

export type DeliveryPresentationTone = "neutral" | "info" | "success" | "warning" | "danger";

/**
 * Only present stored outbound delivery evidence. A queued/accepted request
 * must never be described as delivered. Unknown values fail closed as
 * unconfirmed, rather than inventing a successful provider response.
 */
export function presentOutboundDelivery(
  state: MessageDeliveryState | string,
): { label: string; tone: DeliveryPresentationTone } {
  switch (state) {
    case "QUEUED":
      return { label: "Queued · not delivered", tone: "info" };
    case "RUNNING":
      return { label: "Sending · not yet delivered", tone: "info" };
    case "PROVIDER_ACCEPTED":
      return { label: "Provider accepted · delivery unconfirmed", tone: "info" };
    case "DELIVERED":
      return { label: "Delivered", tone: "success" };
    case "READ":
      return { label: "Read", tone: "success" };
    case "FAILED":
      return { label: "Delivery failed", tone: "danger" };
    case "SUPPRESSED":
      return { label: "Suppressed · not sent", tone: "warning" };
    default:
      return { label: "Delivery unconfirmed", tone: "neutral" };
  }
}
