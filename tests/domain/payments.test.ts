import { describe, expect, it } from "vitest";
import { allocateInvoicePayment, validateVerifiedPaymentFacts, type InvoiceRecord } from "../../src/domain/payments";

const invoice: InvoiceRecord = {
  id: "inv_1",
  workspaceId: "ws_1",
  quoteId: "quote_1",
  status: "ISSUED",
  currency: "USD",
  totalMinor: 34_000,
  allocatedMinor: 8_500,
  refundedMinor: 0,
  balanceMinor: 25_500,
  version: 1,
  createdAt: "2026-10-04T06:00:00.000Z",
  updatedAt: "2026-10-04T06:00:00.000Z",
};

describe("verified payment domain", () => {
  it("validates provider identity and positive integer amount", () => {
    expect(validateVerifiedPaymentFacts({
      provider: "stripe",
      providerAccountId: "acct_demo",
      providerEventId: "evt_1",
      providerTransactionId: "pi_1",
      purpose: "DEPOSIT",
      workspaceId: "ws_1",
      amountMinor: 8_500,
      currency: "USD",
      occurredAt: "2026-10-04T06:05:00.000Z",
    })).toEqual({ ok: true, value: true });

    expect(validateVerifiedPaymentFacts({
      provider: "stripe",
      providerAccountId: "acct_demo",
      providerEventId: "evt_1",
      providerTransactionId: "pi_1",
      purpose: "DEPOSIT",
      workspaceId: "ws_1",
      amountMinor: 0,
      currency: "USD",
      occurredAt: "2026-10-04T06:05:00.000Z",
    })).toMatchObject({ ok: false, code: "PAYMENT_EVENT_INVALID" });
  });

  it("allocates invoice balance without permitting overpayment or closed invoice mutation", () => {
    expect(allocateInvoicePayment(invoice, 25_500, "2026-10-04T07:00:00.000Z")).toMatchObject({
      ok: true,
      value: { status: "PAID", allocatedMinor: 34_000, balanceMinor: 0, version: 2 },
    });
    expect(allocateInvoicePayment(invoice, 25_501, "2026-10-04T07:00:00.000Z")).toMatchObject({ ok: false, code: "PAYMENT_AMOUNT_MISMATCH" });
    expect(allocateInvoicePayment({ ...invoice, status: "PAID" }, 1, "2026-10-04T07:00:00.000Z")).toMatchObject({ ok: false, code: "PAYMENT_INVOICE_CLOSED" });
  });
});
