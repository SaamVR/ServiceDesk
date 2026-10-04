import type { VerifiedPaymentEvent } from "../../core/facade";
import type { VerifiedPaymentWebhook } from "../types";

export type VerifiedPaymentWebhookEventCompatibility =
  VerifiedPaymentWebhook["event"] extends VerifiedPaymentEvent
    ? VerifiedPaymentEvent extends VerifiedPaymentWebhook["event"]
      ? true
      : false
    : false;

export const verifiedPaymentWebhookEventCompatibility: VerifiedPaymentWebhookEventCompatibility = true;

export const E03_PAYMENT_APPLICATION_OUTCOME_DEPENDENCY =
  "Core E03 must expose authoritative applied/duplicate/review outcome semantics after applyVerifiedPayment(event).";

export function verifiedPaymentEventForCore(webhook: VerifiedPaymentWebhook): VerifiedPaymentEvent {
  return webhook.event;
}
