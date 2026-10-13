import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { readCustomerInvoiceLedgerSummary } from "../../src/features/operations/customer-invoice-ledger-summary";

const ledger = { currency: "USD", totalMinor: 24000,
  allocatedMinor: 9000, refundedMinor: 2000, balanceMinor: 17000 };
describe("customer-facing invoice net of refund reconciliation", () => {
  test("shows gross allocation and net after real recorded refunds, not a paid-provider claim", () => {
    expect(readCustomerInvoiceLedgerSummary(ledger)).toEqual({
      ok: true, totalMinor: 24000, grossAllocatedMinor: 9000,
      refundsMinor: 2000, netAppliedMinor: 7000, balanceMinor: 17000,
    });
    expect(readCustomerInvoiceLedgerSummary({ ...ledger,
      allocatedMinor: 24000, refundedMinor: 0, balanceMinor: 0 }))
      .toMatchObject({ ok: true, netAppliedMinor: 24000 });
  });
  test("never formats corrupted amount, refund overflow or unsupported currency as money", () => {
    for (const bad of [
      { refundedMinor: 10000 }, { balanceMinor: 16000 },
      { totalMinor: 0 }, { totalMinor: Number.MAX_SAFE_INTEGER + 1 },
      { allocatedMinor: Number.NaN }, { allocatedMinor: -1 },
      { refundedMinor: 2.5 }, { currency: "usd" }, { currency: "USD\n" },
    ]) expect(readCustomerInvoiceLedgerSummary({ ...ledger, ...bad }))
      .toEqual({ ok: false, reason: "INVOICE_LEDGER_UNVERIFIED" });
  });
  test("customer portal displays only reconciled figures and gates the payment CTA", () => {
    const route = readFileSync(join(process.cwd(),
      "src/features/operations/CustomerProductRoute.tsx"), "utf8");
    const invoice = route.slice(route.indexOf("function InvoiceView("));
    expect(invoice).toContain("const ledger = readCustomerInvoiceLedgerSummary(invoice)");
    expect(invoice).toContain('label="Net applied after refunds"');
    expect(invoice).toContain('label="Payments recorded (gross)"');
    expect(invoice).toContain("invoiceReadiness.ok && ledger.ok ? (");
    expect(invoice).toContain("Saved invoice amounts need verification");
    expect(invoice).toContain("not independent bank or provider receipts");
  });
});
