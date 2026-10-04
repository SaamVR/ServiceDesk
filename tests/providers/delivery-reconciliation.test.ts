import { describe, expect, test } from "vitest";
import { reconcileUncertainDelivery } from "../../src/server/integrations/delivery/reconciliation";

describe("uncertain delivery reconciliation", () => {
  test("does not resend when provider lookup finds accepted or delivered", () => {
    const accepted = reconcileUncertainDelivery({
      idempotencyKey: "msg-1",
      lookup: "FOUND_ACCEPTED",
      checkedAt: "2026-10-04T07:40:00.000Z",
    });
    const delivered = reconcileUncertainDelivery({
      idempotencyKey: "msg-2",
      lookup: "FOUND_DELIVERED",
      checkedAt: "2026-10-04T07:40:00.000Z",
    });

    expect(accepted).toMatchObject({ action: "DO_NOT_RESEND", providerAccepted: true, delivered: false });
    expect(delivered).toMatchObject({ action: "DO_NOT_RESEND", providerAccepted: true, delivered: true });
  });

  test("allows retry with the original logical idempotency key only when provider confirms not found", () => {
    const decision = reconcileUncertainDelivery({
      idempotencyKey: "msg-1",
      lookup: "NOT_FOUND",
      checkedAt: "2026-10-04T07:40:00.000Z",
    });

    expect(decision).toMatchObject({
      action: "RETRY_ORIGINAL_IDEMPOTENCY_KEY",
      retryable: true,
      idempotencyKey: "msg-1",
      mutatesBusinessTruth: false,
    });
  });

  test("defers retry when provider lookup is unavailable", () => {
    const decision = reconcileUncertainDelivery({
      idempotencyKey: "msg-1",
      lookup: "LOOKUP_UNAVAILABLE",
      checkedAt: "2026-10-04T07:40:00.000Z",
    });

    expect(decision).toMatchObject({
      action: "DEFER",
      retryable: false,
      requiresProviderLookup: true,
      duplicateSendRisk: true,
    });
  });
});
