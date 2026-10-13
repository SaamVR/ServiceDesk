import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { verifiedSandboxSessionShape } from "../../src/features/operations/sandbox-session-integrity";

const ids = {
  id: "11111111-1111-4111-8111-111111111111",
  workspace_id: "22222222-2222-4222-8222-222222222222",
  customer_id: "33333333-3333-4333-8333-333333333333",
  quote_id: "44444444-4444-4444-8444-444444444444",
};
const balance = { ...ids, purpose: "BALANCE", invoice_id: "55555555-5555-4555-8555-555555555555",
  amount_minor: 8750, currency: "USD", status: "OPEN", expires_at: "2030-02-01T12:00:00.000Z" };

describe("persisted sandbox checkout validation", () => {
  test("allows the actual deposit and invoice fixture shapes", () => {
    expect(verifiedSandboxSessionShape(balance)).toBe(true);
    expect(verifiedSandboxSessionShape({ ...balance, purpose: "DEPOSIT",
      hold_id: "66666666-6666-4666-8666-666666666666", invoice_id: null })).toBe(true);
    expect(verifiedSandboxSessionShape({ ...balance, status: "APPLIED" })).toBe(true);
  });
  test("refuses unknown purpose, corrupted dates and forged paid-status replay", () => {
    for (const patch of [
      { purpose: "CHARGE" }, { status: "DELIVERED" }, { expires_at: "not-a-date" },
      { expires_at: null }, { amount_minor: 0 }, { amount_minor: -1 },
      { amount_minor: "8750" }, { amount_minor: Number.POSITIVE_INFINITY },
      { amount_minor: Number.MAX_SAFE_INTEGER+1 },
      { currency: "usd" }, { currency: "USD\nInjected" }, { quote_id: "foreign" },
      { customer_id: "" }, { invoice_id: null },
    ]) expect(verifiedSandboxSessionShape({ ...balance, ...patch })).toBe(false);
    expect(verifiedSandboxSessionShape({ ...balance, purpose: "DEPOSIT" })).toBe(false);
  });
  test("checks both the authenticated customer display and the finalize action", () => {
    const source = readFileSync(join(process.cwd(),
      "src/features/operations/customer-product-runtime.ts"),"utf8");
    const display=source.slice(source.indexOf("export async function loadCustomerSandboxCheckout("),
      source.indexOf("export async function completeCustomerSandboxCheckout("));
    const finalize=source.slice(source.indexOf("export async function completeCustomerSandboxCheckout("));
    for (const code of [display,finalize]) {
      expect(code.indexOf('eq("customer_id", resolved.value.customer.id)')).toBeGreaterThan(-1);
      expect(code.indexOf("verifiedSandboxSessionShape(")).toBeGreaterThan(
        code.indexOf('eq("customer_id", resolved.value.customer.id)'));
    }
    expect(finalize.indexOf("verifiedSandboxSessionShape(session)")).toBeLessThan(finalize.indexOf('sessionStatus === "APPLIED"'));
    expect(finalize.indexOf("verifiedSandboxSessionShape(session)")).toBeLessThan(finalize.indexOf("signStripeFixturePayload("));
  });
});
