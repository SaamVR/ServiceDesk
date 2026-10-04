import { describe, expect, test } from "vitest";
import { buildPaymentRecoveryEvent, buildPaymentRecoveryReceipt } from "../../src/server/integrations/payments/recovery";
import { classifyProviderRecovery } from "../../src/server/integrations/recovery/policy";

describe("payment recovery bridge", () => {
  test("routes retryable provider failures into recovery retry decisions", () => {
    const event = buildPaymentRecoveryEvent({
      status: "TRANSIENT_FAILURE",
      operation: "CALLBACK_APPLY",
      providerEventId: "evt_123",
      providerTransactionId: "pi_123",
      attempts: 1,
      maxAttempts: 3,
      occurredAt: "2026-10-04T12:00:00.000Z",
    });

    const decision = classifyProviderRecovery(event);
    expect(decision).toMatchObject({ provider: "PAYMENT", action: "RETRY", retryable: true, mutatesBusinessTruth: false });
  });

  test("routes exhausted retry budget to operator review", () => {
    const event = buildPaymentRecoveryEvent({
      status: "TRANSIENT_FAILURE",
      operation: "CALLBACK_APPLY",
      providerEventId: "evt_123",
      providerTransactionId: "pi_123",
      attempts: 3,
      maxAttempts: 3,
      occurredAt: "2026-10-04T12:00:00.000Z",
    });

    expect(classifyProviderRecovery(event)).toMatchObject({ action: "OPERATOR_REVIEW", retryable: false, terminal: true });
  });

  test("routes permanent failures to dead-letter without exposing transaction details", () => {
    const event = buildPaymentRecoveryEvent({
      status: "PERMANENT_FAILURE",
      operation: "CALLBACK_APPLY",
      providerEventId: "evt_123",
      providerTransactionId: "pi_secret_customer_reference",
      attempts: 1,
      maxAttempts: 3,
      occurredAt: "2026-10-04T12:00:00.000Z",
    });
    const decision = classifyProviderRecovery(event);
    const receipt = buildPaymentRecoveryReceipt(event, decision);

    expect(decision).toMatchObject({ action: "DEAD_LETTER", terminal: true });
    expect(receipt).toMatchObject({ provider: "PAYMENT", canMutateBusinessTruth: false, action: "DEAD_LETTER" });
    expect(JSON.stringify(receipt)).not.toContain("secret");
    expect(JSON.stringify(receipt)).not.toContain("customer");
  });
});
