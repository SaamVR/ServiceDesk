import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { assessOperationalQuoteSend } from "../../src/features/operations/quote-send-readiness";

const quote = {
  id: "11111111-1111-4111-8111-111111111111",
  status: "APPROVED",
  currency: "USD",
  version: 1,
  valid_until: "2031-01-01T00:00:00.000Z",
  subtotal_minor: 31000,
  tax_minor: 0,
  total_minor: 31000,
  deposit_minor: 7750,
  balance_minor: 23250,
  duration_minutes: 210,
  snapshot: { lineItems: [
    { code: "BASE", description: "Base cleaning", amountMinor: 18000, durationMinutes: 120 },
    { code: "BEDROOM", description: "3 bedrooms", amountMinor: 9000, durationMinutes: 60 },
    { code: "BATHROOM", description: "2 bathrooms", amountMinor: 4000, durationMinutes: 30 },
  ] },
};
const now = "2026-10-13T03:00:00.000Z";
describe("staff quote-send financial/expiry gate", () => {
  it("permits a saved owner-priced, fully reconciled approved quote", () => {
    expect(assessOperationalQuoteSend(quote, now)).toEqual({ ok: true });
  });
  it("blocks stale, expired and non-approved quote before any send", () => {
    expect(assessOperationalQuoteSend({ ...quote, status: "PENDING_APPROVAL" }, now))
      .toEqual({ ok: false, reason: "NOT_APPROVED" });
    expect(assessOperationalQuoteSend({ ...quote, valid_until: now }, now))
      .toEqual({ ok: false, reason: "EXPIRED" });
    expect(assessOperationalQuoteSend({ ...quote, valid_until: "bad" }, now))
      .toEqual({ ok: false, reason: "EXPIRED" });
  });
  it("blocks corrupt deposit and fabricated or absent line items", () => {
    for (const patch of [
      { deposit_minor: 9000 }, { balance_minor: 100 },
      { subtotal_minor: 30000 }, { total_minor: 50000 },
      { duration_minutes: 209 }, { snapshot: null },
      { snapshot: { lineItems: [{
        code: "BASE", description: "Only some cleaning", amountMinor: 31000, durationMinutes: 200,
      }] } },
    ]) {
      expect(assessOperationalQuoteSend({ ...quote, ...patch }, now))
        .toEqual({ ok: false, reason: "CHARGES_UNVERIFIED" });
    }
  });
  it("rejects missing or unapproved currency and zero-value charges before sending", () => {
    for (const currency of [undefined, "", "usd", "USDX", null]) {
      expect(assessOperationalQuoteSend({ ...quote, currency }, now))
        .toEqual({ ok: false, reason: "CHARGES_UNVERIFIED" });
    }
    expect(assessOperationalQuoteSend({
      ...quote, total_minor: 0, subtotal_minor: 0, tax_minor: 0,
      deposit_minor: 0, balance_minor: 0,
      snapshot: { lineItems: [{ code: "BASE", description: "Base", amountMinor: 0, durationMinutes: 210 }] },
    }, now)).toEqual({ ok: false, reason: "CHARGES_UNVERIFIED" });
  });
  it("wires the preflight behind branch auth and before the versioned send RPC", () => {
    const source = readFileSync(join(process.cwd(),
      "src/features/operations/operational-product-runtime.ts"), "utf8");
    const code = source.slice(source.indexOf("export async function sendOperationalQuote("),
      source.indexOf("export async function applyOperationalManualPayment("));
    expect(code.indexOf('requireOperationalBranchResource(resolved.value, "quote", quoteId)')).toBeGreaterThan(-1);
    expect(code.indexOf("assessOperationalQuoteSend(current.data"))
      .toBeGreaterThan(code.indexOf('requireOperationalBranchResource(resolved.value, "quote", quoteId)'));
    expect(code.indexOf("facade.sendQuote(")).toBeGreaterThan(code.indexOf("assessOperationalQuoteSend(current.data"));
    expect(code).toContain('eq("workspace_id", resolved.value.workspace.id)');
  });
});
