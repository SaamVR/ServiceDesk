import { describe, expect, test } from "vitest";
import {
  mapEmailCallbackToDeliveryState,
  mapN8nReceiptToDeliveryState,
  mapWebhookExecutionToDeliveryState,
} from "../../src/server/integrations/delivery-semantics";

describe("provider delivery semantics", () => {
  test("maps email callback states without treating acceptance as delivery", () => {
    expect(mapEmailCallbackToDeliveryState({ eventType: "DELIVERED" })).toMatchObject({ state: "DELIVERED", deliveryProof: true, failure: false });
    expect(mapEmailCallbackToDeliveryState({ eventType: "BOUNCE", bounceType: "soft" })).toMatchObject({ state: "RETRYABLE_FAILURE", deliveryProof: false, failure: true });
    expect(mapEmailCallbackToDeliveryState({ eventType: "BOUNCE", bounceType: "hard" })).toMatchObject({ state: "FAILED", deliveryProof: false, failure: true });
    expect(mapEmailCallbackToDeliveryState({ eventType: "COMPLAINT" })).toMatchObject({ state: "FAILED", deliveryProof: false, failure: true });
  });

  test("maps webhook execution results as delivery to receiver only", () => {
    expect(mapWebhookExecutionToDeliveryState({ outcome: "DELIVERED", retryable: false })).toMatchObject({ state: "DELIVERED", deliveryProof: true, businessMutationAllowed: false });
    expect(mapWebhookExecutionToDeliveryState({ outcome: "RETRY", retryable: true })).toMatchObject({ state: "RETRYABLE_FAILURE", deliveryProof: false });
    expect(mapWebhookExecutionToDeliveryState({ outcome: "FAILED_FINAL", retryable: false })).toMatchObject({ state: "FAILED", deliveryProof: false });
  });

  test("maps n8n receipts as automation delivery, not business truth", () => {
    expect(mapN8nReceiptToDeliveryState({ deliveryState: "DELIVERED_TO_AUTOMATION" })).toMatchObject({ state: "DELIVERED", deliveryProof: true, businessMutationAllowed: false });
    expect(mapN8nReceiptToDeliveryState({ deliveryState: "PENDING_AUTOMATION_COMPLETION" })).toMatchObject({ state: "ACCEPTED", deliveryProof: false });
    expect(mapN8nReceiptToDeliveryState({ deliveryState: "RETRYABLE_FAILURE" })).toMatchObject({ state: "RETRYABLE_FAILURE", failure: true });
    expect(mapN8nReceiptToDeliveryState({ deliveryState: "FINAL_FAILURE" })).toMatchObject({ state: "FAILED", failure: true });
  });
});
