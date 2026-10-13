import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { customerInvoiceSandboxReadiness } from "../../src/features/operations/customer-invoice-checkout-readiness";

const issued = {
  status: "ISSUED", totalMinor: 34000, allocatedMinor: 8500,
  refundedMinor: 0, balanceMinor: 25500, currency: "USD",
  quoteStatus: "ACCEPTED", quoteCurrency: "USD",
};
describe("V4 real customer invoice sandbox payment preflight", () => {
  test("permits verified issued or partially paid balances, including legitimate refunds", () => {
    expect(customerInvoiceSandboxReadiness(issued)).toEqual({ ok: true, amountMinor: 25500, currency: "USD" });
    expect(customerInvoiceSandboxReadiness({ ...issued, status: "PARTIALLY_PAID",
      allocatedMinor: 15000, refundedMinor: 5000, balanceMinor: 24000 }))
      .toEqual({ ok: true, amountMinor: 24000, currency: "USD" });
  });
  test("never opens a checkout against void, draft, paid or unaccepted business state", () => {
    for (const status of ["VOID", "DRAFT", "PENDING_APPROVAL", "CANCELLED"]) {
      expect(customerInvoiceSandboxReadiness({ ...issued, status }))
        .toMatchObject({ ok: false, reason: "NOT_ISSUED" });
    }
    expect(customerInvoiceSandboxReadiness({ ...issued, status: "PAID", balanceMinor: 0 }))
      .toMatchObject({ ok: false, reason: "NO_BALANCE" });
    expect(customerInvoiceSandboxReadiness({ ...issued, status: "VOID", balanceMinor: 0 }))
      .toMatchObject({ ok: false, reason: "NOT_ISSUED" });
    expect(customerInvoiceSandboxReadiness({ ...issued, status: "DRAFT", balanceMinor: 0 }))
      .toMatchObject({ ok: false, reason: "NOT_ISSUED" });
    expect(customerInvoiceSandboxReadiness({ ...issued, quoteStatus: "SENT" }))
      .toMatchObject({ ok: false, reason: "QUOTE_NOT_ACCEPTED" });
  });
  test("does not charge mismatched or manipulated amounts/currencies", () => {
    for (const patch of [
      { balanceMinor: 26000 }, { allocatedMinor: 9000 },
      { refundedMinor: 9000 }, { totalMinor: 31000 },
      { balanceMinor: Number.NaN }, { balanceMinor: -1 },
      { allocatedMinor: 0, refundedMinor: 1 },
    ]) {
      expect(customerInvoiceSandboxReadiness({ ...issued, ...patch }))
        .toMatchObject({ ok: false, reason: "AMOUNTS_MISMATCH" });
    }
    expect(customerInvoiceSandboxReadiness({ ...issued, quoteCurrency: "GBP" }))
      .toMatchObject({ ok: false, reason: "CURRENCY_MISMATCH" });
  });
  test("wires an ownership-scoped preflight before any new session insert", () => {
    const runtime = readFileSync(join(process.cwd(),
      "src/features/operations/customer-product-runtime.ts"), "utf8");
    const ui = readFileSync(join(process.cwd(),
      "src/features/operations/CustomerProductRoute.tsx"), "utf8");
    const action = runtime.slice(runtime.indexOf("export async function launchCustomerInvoiceSandboxCheckout"),
      runtime.indexOf("export async function",runtime.indexOf("export async function launchCustomerInvoiceSandboxCheckout")+20));
    expect(action.indexOf("loadCustomerOwnedInvoiceContext(resolved.value, invoiceId)")).toBeGreaterThan(-1);
    expect(action.indexOf("customerInvoiceSandboxReadiness({"))
      .toBeGreaterThan(action.indexOf("loadCustomerOwnedInvoiceContext(resolved.value, invoiceId)"));
    expect(action.indexOf('.from("sandbox_checkout_sessions")'))
      .toBeGreaterThan(action.indexOf("customerInvoiceSandboxReadiness({"));
    expect(ui).toContain("const invoiceReadiness = customerInvoiceSandboxReadiness(");
    expect(ui).toContain("invoiceReadiness.ok && ledger.ok ? (");
    expect(ui).toContain("readCustomerInvoiceLedgerSummary(invoice)");
    expect(ui).toContain("Invoice payment needs review");
  });
});
