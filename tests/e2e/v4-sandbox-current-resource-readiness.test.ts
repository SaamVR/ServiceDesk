import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { customerInvoiceSandboxReadiness } from "../../src/features/operations/customer-invoice-checkout-readiness";

describe("verified current customer checkout page, not stale session metadata", () => {
  const runtime=readFileSync(join(process.cwd(),"src/features/operations/customer-product-runtime.ts"),"utf8");
  const page=readFileSync(join(process.cwd(),"src/features/operations/SandboxCheckoutProductRoute.tsx"),"utf8");
  const load=runtime.slice(runtime.indexOf("export async function loadCustomerSandboxCheckout("),
    runtime.indexOf("export async function completeCustomerSandboxCheckout("));
  test("rechecks current saved invoice ledger, accepted quote and exact session money", () => {
    expect(load).toContain("const readiness = customerInvoiceSandboxReadiness({");
    expect(load).toContain("readiness.amountMinor === numberValue(row, \"amount_minor\")");
    expect(load).toContain("readiness.currency === String(row.currency)");
    expect(load).toContain("context.quote.id === quoteId");
    const good=customerInvoiceSandboxReadiness({
      status:"PARTIALLY_PAID",currency:"USD",quoteStatus:"ACCEPTED",
      quoteCurrency:"USD",totalMinor:24000,allocatedMinor:8000,refundedMinor:1000,balanceMinor:17000,
    });
    expect(good).toEqual({ok:true,currency:"USD",amountMinor:17000});
    expect(customerInvoiceSandboxReadiness({
      status:"PARTIALLY_PAID",currency:"USD",quoteStatus:"ACCEPTED",
      quoteCurrency:"USD",totalMinor:24000,allocatedMinor:8000,refundedMinor:1000,balanceMinor:16000,
    })).toMatchObject({ok:false,reason:"AMOUNTS_MISMATCH"});
  });
  test("rechecks held deposit expiry, quote acceptance and same current money", () => {
    expect(load).toContain("resourceStatus === \"HELD\"");
    expect(load).toContain('quoteStatus === "ACCEPTED"');
    expect(load).toContain("Number.isFinite(holdExpiry) && holdExpiry > Date.now()");
    expect(load).toContain("quoteContext.quote.currency === String(row.currency)");
  });
  test("does not expose Complete sandbox payment on an unverified resource", () => {
    expect(page).toContain("session.resourceReady === true");
    expect(page).toContain("Payment conditions changed");
    expect(page).toContain("refund-adjusted saved balance could not be verified");
    expect(page.indexOf("session.resourceReady === true")).toBeLessThan(
      page.indexOf("Complete sandbox payment"));
  });
});
