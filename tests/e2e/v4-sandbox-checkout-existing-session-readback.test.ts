import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const source = readFileSync(join(process.cwd(), "src/features/operations/customer-product-runtime.ts"), "utf8");

function action(name: string, next: string): string {
  const start = source.indexOf("export async function " + name);
  const end = source.indexOf("export async function " + next, start + 20);
  if (start < 0 || end <= start) throw new Error("Missing customer checkout action");
  return source.slice(start, end);
}

describe("customer checkout session readback failure boundary", () => {
  test("deposit lookup errors fail closed after ownership/hold checks before any insert", () => {
    const code = action("launchCustomerDepositSandboxCheckout", "launchCustomerInvoiceSandboxCheckout");
    const owner = code.indexOf("loadCustomerOwnedQuoteContext(resolved.value, quoteId)");
    const hold = code.indexOf('from("slot_holds")');
    const lookup = code.indexOf('from("sandbox_checkout_sessions")');
    const blocked = code.indexOf("if (existing.error)");
    const insert = code.indexOf('.insert({');
    expect(owner).toBeGreaterThan(-1);
    expect(hold).toBeGreaterThan(owner);
    expect(lookup).toBeGreaterThan(hold);
    expect(blocked).toBeGreaterThan(lookup);
    expect(insert).toBeGreaterThan(blocked);
    expect(code).toContain("Existing checkout state could not be verified");
  });
  test("balance lookup errors fail closed after verified linked customer invoice", () => {
    const code = action("launchCustomerInvoiceSandboxCheckout", "loadCustomerSandboxCheckout");
    const owner = code.indexOf("loadCustomerOwnedInvoiceContext(resolved.value, invoiceId)");
    const readiness = code.indexOf("customerInvoiceSandboxReadiness({");
    const lookup = code.indexOf('from("sandbox_checkout_sessions")');
    const blocked = code.indexOf("if (existing.error)");
    const insert = code.indexOf(".insert({");
    expect(owner).toBeGreaterThan(-1);
    expect(readiness).toBeGreaterThan(owner);
    expect(lookup).toBeGreaterThan(readiness);
    expect(blocked).toBeGreaterThan(lookup);
    expect(insert).toBeGreaterThan(blocked);
  });
});
