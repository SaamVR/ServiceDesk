import { describe, expect, test } from "vitest";
import { isVerifiedStaffCollectibleInvoice } from "../../src/features/operations/staff-invoice-collection-readiness";

const invoice = {
  status: "PARTIALLY_PAID", currency: "USD",
  totalMinor: 24000, allocatedMinor: 9000, refundedMinor: 2000,
  balanceMinor: 17000,
};

describe("manual invoice collection readiness", () => {
  test("requires saved payment allocations and refunds to reconcile", () => {
    expect(isVerifiedStaffCollectibleInvoice(invoice)).toBe(true);
    expect(isVerifiedStaffCollectibleInvoice({ ...invoice, refundedMinor: 3000 })).toBe(false);
    expect(isVerifiedStaffCollectibleInvoice({ ...invoice, balanceMinor: 16000 })).toBe(false);
    expect(isVerifiedStaffCollectibleInvoice({ ...invoice, allocatedMinor: 7000 })).toBe(false);
  });
  test("does not offer collection on unissued or settled invoices", () => {
    for (const status of ["DRAFT", "VOID", "PAID"]) {
      expect(isVerifiedStaffCollectibleInvoice({ ...invoice, status })).toBe(false);
    }
    expect(isVerifiedStaffCollectibleInvoice({ ...invoice, balanceMinor: 0 })).toBe(false);
    expect(isVerifiedStaffCollectibleInvoice({ ...invoice, totalMinor: Number.NaN })).toBe(false);
  });
});
