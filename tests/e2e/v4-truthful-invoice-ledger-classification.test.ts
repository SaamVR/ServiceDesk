import { describe, expect, test } from "vitest";
import { customerInvoiceSandboxReadiness } from "../../src/features/operations/customer-invoice-checkout-readiness";
import { isVerifiedStaffCollectibleInvoice } from "../../src/features/operations/staff-invoice-collection-readiness";

const clean = {
  status: "PARTIALLY_PAID", currency: "USD",
  totalMinor: 32000, allocatedMinor: 10000, refundedMinor: 2000,
  balanceMinor: 24000, quoteStatus: "ACCEPTED", quoteCurrency: "USD",
};

describe("financially truthful customer and staff invoice readiness", () => {
  test("accepts a genuine partially paid invoice with refunded allocation", () => {
    expect(customerInvoiceSandboxReadiness(clean)).toEqual({
      ok: true, amountMinor: 24000, currency: "USD",
    });
    expect(isVerifiedStaffCollectibleInvoice(clean)).toBe(true);
  });
  test("PAID status with an outstanding balance is not payment complete", () => {
    expect(customerInvoiceSandboxReadiness({ ...clean, status: "PAID" }))
      .toMatchObject({ ok: false, reason: "AMOUNTS_MISMATCH" });
    expect(isVerifiedStaffCollectibleInvoice({ ...clean, status: "PAID" })).toBe(false);
  });
  test("zero-balance corrupt totals cannot be described as settled", () => {
    const corrupt = { ...clean, balanceMinor: 0 };
    expect(customerInvoiceSandboxReadiness(corrupt))
      .toMatchObject({ ok: false, reason: "AMOUNTS_MISMATCH" });
    expect(isVerifiedStaffCollectibleInvoice(corrupt)).toBe(false);
  });
  test("truly settled paid invoice is a no-balance state", () => {
    expect(customerInvoiceSandboxReadiness({ ...clean,
      status: "PAID", allocatedMinor: 34000, balanceMinor: 0,
    })).toMatchObject({ ok: false, reason: "NO_BALANCE" });
  });
  test("unsafe integer sum can never be accepted as a payable amount", () => {
    const huge = { ...clean, totalMinor: Number.MAX_SAFE_INTEGER,
      allocatedMinor: Number.MAX_SAFE_INTEGER, refundedMinor: 0, balanceMinor: 1,
    };
    expect(customerInvoiceSandboxReadiness(huge))
      .toMatchObject({ ok: false, reason: "AMOUNTS_MISMATCH" });
    expect(isVerifiedStaffCollectibleInvoice(huge)).toBe(false);
  });
});
