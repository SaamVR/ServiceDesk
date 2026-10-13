import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { customerInvoiceSandboxReadiness } from "../../src/features/operations/customer-invoice-checkout-readiness";

const original = {
  status: "ISSUED",
  totalMinor: 32000,
  allocatedMinor: 8000,
  refundedMinor: 0,
  balanceMinor: 24000,
  currency: "USD",
  quoteStatus: "ACCEPTED",
  quoteCurrency: "USD",
};

describe("sandbox balance payment revalidation at completion", () => {
  test("authorizes an unchanged current issued invoice and accepted quote", () => {
    const status = customerInvoiceSandboxReadiness(original);
    expect(status).toEqual({ ok: true, amountMinor: 24000, currency: "USD" });
  });
  test("fails closed if quote status or issued invoice changes before finalization", () => {
    for (const patch of [
      { status: "DRAFT" }, { status: "VOID" }, { status: "PAID", balanceMinor: 0 },
      { quoteStatus: "DECLINED" }, { quoteStatus: "SENT" },
    ]) {
      expect(customerInvoiceSandboxReadiness({ ...original, ...patch }).ok).toBe(false);
    }
  });
  test("fails closed when paid/refunded ledger and currency change after opening", () => {
    for (const patch of [
      { allocatedMinor: 9000 }, { refundedMinor: 1000 },
      { balanceMinor: 10000 }, { quoteCurrency: "EUR" },
      { balanceMinor: Number.NaN },
    ]) {
      expect(customerInvoiceSandboxReadiness({ ...original, ...patch }).ok).toBe(false);
    }
  });
  test("requires the fresh invoice proof before constructing signed payment fixture", () => {
    const s = readFileSync(join(process.cwd(), "src/features/operations/customer-product-runtime.ts"),"utf8");
    const start=s.indexOf("export async function completeCustomerSandboxCheckout(");
    const code=s.slice(start);
    const branch=code.indexOf('if (!invoiceId) return { ok: false, ...refs');
    const owner=code.indexOf("loadCustomerOwnedInvoiceContext(resolved.value, invoiceId)",branch);
    const guard=code.indexOf("customerInvoiceSandboxReadiness({",owner);
    const check=code.indexOf("!readiness.ok || readiness.amountMinor !== sessionAmount",guard);
    const signature=code.indexOf("signStripeFixturePayload(",guard);
    expect(start).toBeGreaterThan(-1);
    expect(branch).toBeGreaterThan(-1);
    expect(owner).toBeGreaterThan(branch);
    expect(guard).toBeGreaterThan(owner);
    expect(check).toBeGreaterThan(guard);
    expect(signature).toBeGreaterThan(check);
    expect(code).toContain('status: "CANCELLED", updated_at: nowIso');
  });
});
