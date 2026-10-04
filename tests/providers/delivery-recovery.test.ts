import { describe, expect, test } from "vitest";
import { decideDeliveryRecovery, redriveDeadLetter } from "../../src/server/integrations/delivery/recovery";

describe("delivery recovery policy", () => {
  test("worker restart does not resend provider-accepted delivery", () => {
    expect(
      decideDeliveryRecovery({
        state: "PROVIDER_ACCEPTED",
        idempotencyKey: "delivery-1",
        attempts: 1,
        maxAttempts: 4,
      }),
    ).toMatchObject({
      action: "DO_NOT_RESEND",
      preservesIdempotency: true,
      duplicateSendRisk: false,
    });
  });

  test("uncertain send requires provider reconciliation before retry", () => {
    expect(
      decideDeliveryRecovery({
        state: "UNCERTAIN",
        idempotencyKey: "delivery-2",
        attempts: 1,
        maxAttempts: 4,
      }),
    ).toMatchObject({
      action: "RECONCILE",
      retryable: false,
      requiresProviderLookup: true,
      duplicateSendRisk: true,
    });
  });

  test("retryable pre-send failure can retry with original idempotency key", () => {
    const result = decideDeliveryRecovery({
      state: "FAILED_RETRYABLE",
      idempotencyKey: "delivery-3",
      attempts: 1,
      maxAttempts: 4,
    });

    expect(result).toMatchObject({
      action: "RETRY",
      retryable: true,
      preservesIdempotency: true,
    });
  });

  test("permanent failure dead-letters and can be redriven after operator review", () => {
    const decision = decideDeliveryRecovery({
      state: "FAILED_PERMANENT",
      idempotencyKey: "delivery-4",
      attempts: 2,
      maxAttempts: 4,
    });
    expect(decision.action).toBe("DEAD_LETTER");

    const redrive = redriveDeadLetter({
      originalIdempotencyKey: "delivery-4",
      operatorReason: "Provider restriction corrected",
      requestedAt: "2026-10-04T06:55:00.000Z",
    });

    expect(redrive).toMatchObject({
      action: "RETRY",
      idempotencyKey: "delivery-4",
      operatorApproved: true,
      mutatesBusinessTruth: false,
    });
  });

  test("exhausted transient failures route to operator review", () => {
    expect(
      decideDeliveryRecovery({
        state: "FAILED_RETRYABLE",
        idempotencyKey: "delivery-5",
        attempts: 4,
        maxAttempts: 4,
      }),
    ).toMatchObject({ action: "OPERATOR_REVIEW", retryable: false });
  });
});
