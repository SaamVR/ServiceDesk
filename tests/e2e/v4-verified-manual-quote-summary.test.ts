import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { verifiedManualQuoteHandoffMessage } from "../../src/features/operations/quote-manual-handoff";

const facts = {
  quoteId: "11111111-1111-4111-8111-111111111111",
  status: "SENT", currency: "USD", validUntil: "2030-01-01T00:00:00Z",
  subtotalMinor: 31000, taxMinor: 0, totalMinor: 31000,
  depositMinor: 7750, balanceMinor: 23250, durationMinutes: 210,
  lineItems: [
    { code: "BASE", description: "Base cleaning", amountMinor: 18000, durationMinutes: 120 },
    { code: "BEDROOM", description: "Bedrooms", amountMinor: 9000, durationMinutes: 60 },
    { code: "BATHROOM", description: "Bathrooms", amountMinor: 4000, durationMinutes: 30 },
  ],
};
const origin="https://servicedesk-v3-frontend-review.onrender.com";
const now=new Date("2026-10-13T04:00:00.000Z");

describe("manual quote handoff with real owner-priced, verified itemization", () => {
  it("includes exact persisted prices, expiry and authenticated customer link without delivery claims", () => {
    const text=verifiedManualQuoteHandoffMessage(facts,origin,now);
    expect(text).toContain("Base cleaning — $180.00");
    expect(text).toContain("Quote total: $310.00");
    expect(text).toContain("Deposit: $77.50");
    expect(text).toContain("Remaining balance: $232.50");
    expect(text).toContain(origin+"/portal/quotes/"+facts.quoteId);
    expect(text).toContain("customer sign-in required");
    expect(text).toContain("not a payment receipt or booking confirmation");
  });
  it("refuses missing breakdown, corrupted ledger, stale quote and forged destinations", () => {
    for (const patch of [
      { status: "DRAFT" }, { validUntil:"2010-01-01T00:00:00Z" },
      { taxMinor:500 }, { totalMinor:35000 }, { balanceMinor:23000 },
      { lineItems: [] }, { lineItems: null },
      { lineItems: [{code:"BASE",description:"Wrong amount",amountMinor:31001,durationMinutes:210}] },
      { currency:"usd" }, { quoteId:"foreign" },
    ]) {
      expect(verifiedManualQuoteHandoffMessage({...facts,...patch},origin,now)).toBeNull();
    }
    for (const badOrigin of [
      "http://evil.example", "https://evil.example/path",
      "https://evil.example/?redirect=1", "https://user:secret@evil.example",
    ]) {
      expect(verifiedManualQuoteHandoffMessage(facts,badOrigin,now)).toBeNull();
    }
  });
  it("offers explicit manual copy only on persisted SENT quote records",()=>{
    const component=readFileSync(join(process.cwd(),
      "src/features/operations/QuoteCustomerHandoff.tsx"),"utf8");
    const page=readFileSync(join(process.cwd(),
      "src/features/operations/OperationalProductRoute.tsx"),"utf8");
    expect(page).toContain('selectedQuote.status === "SENT" ? (');
    expect(page).toContain("facts={selectedQuote.lineItems?.length ? {");
    expect(component).toContain("verifiedManualQuoteHandoffMessage(facts, window.location.origin)");
    expect(component).toContain("Staff must check the recipient and send it manually;");
    expect(component).toContain("This is not a delivery receipt");
    expect(component).not.toContain("fetch(");
    expect(component).not.toContain("sendWhatsApp");
  });
});
