import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("sandbox checkout UI uses currently saved invoice and quote state", () => {
  const runtime=readFileSync(join(process.cwd(),"src/features/operations/customer-product-runtime.ts"),"utf8");
  const ui=readFileSync(join(process.cwd(),"src/features/operations/SandboxCheckoutProductRoute.tsx"),"utf8");
  const load=runtime.slice(runtime.indexOf("export async function loadCustomerSandboxCheckout("),
    runtime.indexOf("export async function completeCustomerSandboxCheckout("));
  it("gets quote state from the customer-owned quote context, not the session", () => {
    expect(load).toContain("loadCustomerOwnedQuoteContext(resolved.value, quoteId)");
    expect(load).toContain("loadCustomerOwnedInvoiceContext(resolved.value, invoiceId)");
    expect(load).toContain("quoteStatus = quoteContext.quote.status");
    expect(load).toContain("quoteStatus = context.quote.status");
    expect(load).toContain("quoteStatus,");
  });
  it("requires current eligible quote and invoice status before showing complete button", () => {
    expect(ui).toContain('session.quoteStatus !== "ACCEPTED"');
    expect(ui).toContain('!["ISSUED", "PARTIALLY_PAID"].includes(session.resourceStatus)');
    expect(ui).toContain('session.resourceStatus !== "HELD"');
    expect(ui).toContain('const canComplete =');
    expect(ui).toContain('session.status === "OPEN"');
    expect(ui).toContain('session.currentAmountMinor > 0');
    expect(ui).toContain('session.quoteStatus ?? "UNVERIFIED"');
    expect(ui).toContain("The linked quote must be accepted and the invoice issued");
  });
});
