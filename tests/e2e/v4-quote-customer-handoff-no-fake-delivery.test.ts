import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("human-review customer quote handoff does not fake provider delivery", () => {
  const route=readFileSync(join(process.cwd(),"src/features/operations/OperationalProductRoute.tsx"),"utf8");
  const handoff=readFileSync(join(process.cwd(),"src/features/operations/QuoteCustomerHandoff.tsx"),"utf8");
  it("only offers manual link after a quote is marked SENT", () => {
    expect(route).toContain('selectedQuote.status === "SENT" ? (');
    expect(route).toContain("<QuoteCustomerHandoff quoteId={selectedQuote.id}");
    expect(route).toContain("facts={selectedQuote.lineItems?.length ? {");
    expect(route).toContain("Delivery not proven here");
    expect(route).toContain("marked sent (delivery unverified)");
    expect(route).not.toContain("The quote is with the customer.");
  });
  it("copies a same-origin authenticated portal URL without dispatching any provider", () => {
    expect(handoff).toContain('"/portal/quotes/" + encodeURIComponent(quoteId)');
    expect(handoff).toContain("new URL(path, window.location.origin).href");
    expect(handoff).toContain("window.navigator.clipboard.writeText");
    expect(handoff).toContain("Link copied. This is not a delivery receipt.");
    expect(handoff).toContain("customers must sign in.");
    expect(handoff).not.toContain("/api/providers/");
    expect(handoff).not.toContain("sendWhatsApp");
    expect(handoff).not.toContain("sendEmail");
  });
});
