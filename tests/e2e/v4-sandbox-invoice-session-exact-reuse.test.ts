import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { isReusableBalanceSession } from "../../src/features/operations/sandbox-checkout-reuse";

const quoteId = "11111111-1111-4111-8111-111111111111";
const invoiceId = "22222222-2222-4222-8222-222222222222";
const session = { id: "33333333-3333-4333-8333-333333333333", quote_id: quoteId,
  invoice_id: invoiceId, purpose: "BALANCE", status: "OPEN", amount_minor: 12000,
  currency: "USD", expires_at: "2027-01-01T00:00:00Z" };
const expected = { quoteId, invoiceId, amountMinor: 12000, currency: "USD",
  nowMs: Date.parse("2026-10-15T12:00:00Z") };

describe("invoice checkout session source identity before reuse", () => {
  test("reuses a correctly scoped open checkout before expiration", () => {
    expect(isReusableBalanceSession(session,expected)).toBe(true);
  });
  test("refuses cross-quote, cross-invoice, wrong purpose, expired, fake and coerced session", () => {
    const bad = [
      { quote_id: "foreign" }, { invoice_id: "foreign" },
      { purpose: "DEPOSIT" }, { status: "APPLIED" }, { status: "CANCELLED" },
      { amount_minor: "12000" }, { amount_minor: 12001 }, { amount_minor: -1 },
      { currency: "EUR" }, { id: "not-uuid" }, { expires_at: "nonsense" },
      { expires_at: "2020-01-01T00:00:00Z" },
    ];
    for (const patch of bad) {
      expect(isReusableBalanceSession({...session,...patch},expected)).toBe(false);
    }
    expect(isReusableBalanceSession(null,expected)).toBe(false);
  });
  test("enforces authorized quote+invoice filters and pure guard before customer redirect", () => {
    const runtime = readFileSync(join(process.cwd(),
      "src/features/operations/customer-product-runtime.ts"), "utf8");
    const slice = runtime.slice(runtime.indexOf("export async function launchCustomerInvoiceSandboxCheckout("),
      runtime.indexOf("async function hasCommittedSandboxPayment("));
    expect(slice).toContain('eq("customer_id", resolved.value.customer.id)');
    expect(slice).toContain('eq("invoice_id", context.invoice.id)');
    expect(slice).toContain('eq("quote_id", context.quote.id)');
    expect(slice).toContain('eq("purpose", "BALANCE")');
    expect(slice).toContain("isReusableBalanceSession(existing.data, {");
    expect(slice.indexOf("isReusableBalanceSession(existing.data, {"))
      .toBeLessThan(slice.indexOf('return { ok: true, checkoutPath:'));
  });
});
