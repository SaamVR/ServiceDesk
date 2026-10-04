import { describe, expect, test } from "vitest";
import { decidePaymentApplicationState, type PaymentApplicationSnapshot } from "../../src/server/integrations/payments/application-state";

const applied: PaymentApplicationSnapshot = {
  providerEventId: "evt_new",
  providerTransactionId: "pi_1234",
  occurredAt: "2026-10-04T10:00:00.000Z",
  amountMinor: 8500,
  currency: "USD",
  purpose: "DEPOSIT",
  workspaceId: "ws-clearnest",
  state: "APPLIED",
};

describe("payment application idempotency state", () => {
  test("applies first verified payment event", () => {
    expect(decidePaymentApplicationState(undefined, applied)).toEqual({ result: "APPLIED", next: applied, reviewRequired: false });
  });

  test("acknowledges duplicate provider events without another business effect", () => {
    expect(decidePaymentApplicationState(applied, applied)).toEqual({ result: "DUPLICATE", next: applied, reviewRequired: false });
  });

  test("ignores older callbacks after a later verified state", () => {
    expect(
      decidePaymentApplicationState(applied, {
        ...applied,
        providerEventId: "evt_old",
        occurredAt: "2026-10-04T09:59:00.000Z",
      }),
    ).toEqual({ result: "OUT_OF_ORDER_IGNORED", next: applied, reviewRequired: false });
  });

  test("routes amount, currency, purpose, and workspace mismatches to review", () => {
    for (const incoming of [
      { ...applied, providerEventId: "evt_amount", amountMinor: 8600 },
      { ...applied, providerEventId: "evt_currency", currency: "EUR" },
      { ...applied, providerEventId: "evt_purpose", purpose: "BALANCE" as const },
      { ...applied, providerEventId: "evt_workspace", workspaceId: "ws-other" },
    ]) {
      const result = decidePaymentApplicationState(applied, incoming);
      expect(result.result).toBe("PAYMENT_REVIEW");
      expect(result.next).toBe(applied);
      expect(result.reviewRequired).toBe(true);
    }
  });
});
