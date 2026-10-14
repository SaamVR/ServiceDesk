import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { verifyCustomerQuoteForAcceptance } from "../../src/features/operations/customer-quote-acceptance";

const saved = {
  status: "SENT",
  currency: "USD",
  valid_until: "2031-01-01T00:00:00.000Z",
  subtotal_minor: 31000,
  tax_minor: 0,
  total_minor: 31000,
  deposit_minor: 7750,
  balance_minor: 23250,
  duration_minutes: 210,
  snapshot: { lineItems: [
    { code: "BASE", description: "Base service", amountMinor: 18000, durationMinutes: 120 },
    { code: "BEDROOM", description: "Bedrooms", amountMinor: 9000, durationMinutes: 60 },
    { code: "BATHROOM", description: "Bathrooms", amountMinor: 4000, durationMinutes: 30 },
  ] },
};
const now = "2026-10-13T03:00:00.000Z";
describe("V4 customer real quote accept authorization and monetary truth", () => {
  it("allows fully reconciled sent, future-dated saved quote", () => {
    expect(verifyCustomerQuoteForAcceptance(saved, now)).toEqual({ ok: true });
  });
  it("refuses missing or mismatched saved charge line items", () => {
    for (const snapshot of [null, {}, { lineItems: [] }, { lineItems: [
      { code: "BASE", description: "Base service", amountMinor: 31001, durationMinutes: 210 },
    ] }]) {
      expect(verifyCustomerQuoteForAcceptance({ ...saved, snapshot }, now))
        .toEqual({ ok: false, code: "QUOTE_BREAKDOWN_UNVERIFIED" });
    }
  });
  it("rejects total, tax, deposit and balance inconsistencies independently", () => {
    for (const patch of [
      { total_minor: 30000 }, { subtotal_minor: 20000 },
      { tax_minor: -1 }, { deposit_minor: 7700 },
      { balance_minor: 23251 }, { total_minor: Number.NaN },
    ]) {
      expect(verifyCustomerQuoteForAcceptance({ ...saved, ...patch }, now))
        .toEqual({ ok: false, code: "QUOTE_TOTAL_UNVERIFIED" });
    }
  });
  it("rejects missing or malformed currency and zero-value accepted charges", () => {
    for (const currency of [undefined, "", "usd", "USDX", "US D", null]) {
      expect(verifyCustomerQuoteForAcceptance({ ...saved, currency }, now))
        .toEqual({ ok: false, code: "QUOTE_TOTAL_UNVERIFIED" });
    }
    expect(verifyCustomerQuoteForAcceptance({
      ...saved, subtotal_minor: 0, total_minor: 0, deposit_minor: 0,
      balance_minor: 0, tax_minor: 0,
      snapshot: { lineItems: [{ code: "BASE", description: "Base", amountMinor: 0, durationMinutes: 210 }] },
    }, now)).toEqual({ ok: false, code: "QUOTE_TOTAL_UNVERIFIED" });
  });
  it("rejects stale, invalid, expired and non-sent quotes", () => {
    expect(verifyCustomerQuoteForAcceptance({ ...saved, status: "DRAFT" }, now))
      .toEqual({ ok: false, code: "QUOTE_NOT_SENT" });
    for (const valid_until of ["not-a-date", now, "2026-10-12T03:00:00.000Z"]) {
      expect(verifyCustomerQuoteForAcceptance({ ...saved, valid_until }, now))
        .toEqual({ ok: false, code: "QUOTE_EXPIRED" });
    }
  });
  it("keeps ownership check and authoritative guard ahead of actual accept RPC", () => {
    const runtime = readFileSync(join(process.cwd(),
      "src/features/operations/customer-product-runtime.ts"), "utf8");
    const ui = readFileSync(join(process.cwd(),
      "src/features/operations/CustomerProductRoute.tsx"), "utf8");
    const action = runtime.slice(runtime.indexOf("export async function acceptCustomerPortalQuote"),
      runtime.indexOf("export async function holdCustomerPortalSlot"));
    expect(action.indexOf("requestResult.data.customer_id !== resolved.value.customer.id"))
      .toBeGreaterThan(-1);
    expect(action.indexOf("verifyCustomerQuoteForAcceptance("))
      .toBeGreaterThan(action.indexOf("requestResult.data.customer_id !== resolved.value.customer.id"));
    expect(action.indexOf("facade.acceptQuote("))
      .toBeGreaterThan(action.indexOf("verifyCustomerQuoteForAcceptance("));
    expect(ui).toContain("Quote acceptance needs review");
    expect(ui).toContain("quote.lineItems.length > 0");
  });
});
