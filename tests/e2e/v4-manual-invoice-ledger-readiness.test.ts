import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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
  test("both UI and authenticated staff command recheck financial truth", () => {
    const runtime = readFileSync(join(process.cwd(), "src/features/operations/operational-product-runtime.ts"), "utf8");
    const view = readFileSync(join(process.cwd(), "src/features/operations/OperationalProductRoute.tsx"), "utf8");
    const start = runtime.indexOf("export async function applyOperationalManualPayment(");
    const end = runtime.indexOf("export async function ", start + 50);
    const action = runtime.slice(start, end);
    expect(action).toContain('eq("workspace_id", resolved.value.workspace.id)');
    expect(action).toContain("isVerifiedStaffCollectibleInvoice({");
    expect(action).toContain("amountMinor > invoice.data.balance_minor");
    expect(view).toContain("isVerifiedStaffCollectibleInvoice(selectedInvoice)");
    expect(view).toContain("Ledger review required");
  });

  test("does not offer collection on unissued or settled invoices", () => {
    for (const status of ["DRAFT", "VOID", "PAID"]) {
      expect(isVerifiedStaffCollectibleInvoice({ ...invoice, status })).toBe(false);
    }
    expect(isVerifiedStaffCollectibleInvoice({ ...invoice, balanceMinor: 0 })).toBe(false);
    expect(isVerifiedStaffCollectibleInvoice({ ...invoice, totalMinor: Number.NaN })).toBe(false);
  });
});
