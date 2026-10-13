import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { buildStaffQuoteChecklist } from "../../src/features/operations/staff-quote-checklist";

const now = "2026-10-14T00:00:00.000Z";
const quote = {
  status: "APPROVED",
  validUntil: "2030-01-01T00:00:00Z",
  currency: "USD", subtotalMinor: 31000, taxMinor: 0,
  totalMinor: 31000, depositMinor: 7750, balanceMinor: 23250,
  durationMinutes: 210,
  lineItems: [
    { code: "BASE", description: "Base cleaning", amountMinor: 18000, durationMinutes: 120 },
    { code: "BEDROOM", description: "3 bedrooms", amountMinor: 9000, durationMinutes: 60 },
    { code: "BATHROOM", description: "2 bathrooms", amountMinor: 4000, durationMinutes: 30 },
  ],
};
describe("deterministic saved quote preflight", () => {
  test("gives meaningful verified and staff-manual checks without a model or provider", () => {
    const value = buildStaffQuoteChecklist(quote, now);
    expect(value.readyForHumanReview).toBe(true);
    expect(value.items.map(x => x.key)).toEqual(["charges", "validity", "approval", "scope", "delivery"]);
    expect(value.items.filter(x=>x.state==="PASS")).toHaveLength(3);
    expect(value.items.filter(x=>x.state==="MANUAL")).toHaveLength(2);
    expect(value.items.find(x=>x.key==="delivery")?.text).toContain("separate verified evidence");
  });
  test("surfaces optional oven in the actual saved quote as a human consent check", () => {
    const withOven = { ...quote, totalMinor: 34000, subtotalMinor: 34000,
      balanceMinor: 26250, durationMinutes: 240,
      lineItems: [...quote.lineItems,
        { code: "OVEN", description: "Oven add-on", amountMinor: 3000, durationMinutes: 30 }] };
    const result = buildStaffQuoteChecklist(withOven, now);
    expect(result.readyForHumanReview).toBe(true);
    expect(result.items.find(x=>x.key==="scope")?.text).toContain("confirm the customer's choice");
  });
  test("blocks corrupt monetary totals, expired, draft and unknown line item proof", () => {
    for (const patch of [
      { totalMinor: 33000 }, { depositMinor: 7000 }, { taxMinor: 2000 },
      { currency: "usd" }, { durationMinutes: 180 },
      { validUntil: "2020-01-01T00:00:00Z" },
      { validUntil: "invalid" }, { status: "DRAFT" },
      { lineItems: [] }, { lineItems: null }, { subtotalMinor: Number.NaN },
    ]) {
      expect(buildStaffQuoteChecklist({ ...quote, ...patch }, now).readyForHumanReview).toBe(false);
    }
  });
  test("is integrated beside, but not substituted for, paid model review", () => {
    const page = readFileSync(join(process.cwd(),
      "src/features/operations/OperationalProductRoute.tsx"), "utf8");
    const local = readFileSync(join(process.cwd(),
      "src/features/operations/StaffQuoteChecklist.tsx"), "utf8");
    expect(page).toContain("<StaffQuoteChecklist quote={selectedQuote} loadedAt={data.loadedAt} />");
    expect(page).toContain("<AiQuoteReview key={selectedQuote.id}");
    expect(local).toContain("No AI provider, customer contact");
    expect(local).toContain('aria-label="Saved quote staff preflight"');
  });
});
