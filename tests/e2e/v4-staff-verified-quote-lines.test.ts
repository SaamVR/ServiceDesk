import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readVerifiedCustomerQuoteLineItems } from "../../src/features/operations/customer-quote-line-items";

const lines = [
  { code: "BASE", description: "Base cleaning", amountMinor: 18000, durationMinutes: 120 },
  { code: "BEDROOM", description: "3 bedrooms", amountMinor: 9000, durationMinutes: 60 },
  { code: "BATHROOM", description: "2 bathrooms", amountMinor: 4000, durationMinutes: 30 },
];

describe("owner/dispatcher quote disclosure and send readiness", () => {
  it("uses reconciled persisted monetary truth, including optional add-ons", () => {
    expect(readVerifiedCustomerQuoteLineItems({ lineItems: lines }, 31000, 210, 0, 31000))
      .toEqual(lines);
    const withOven = [...lines, { code: "OVEN", description: "Oven cleaning", amountMinor: 3000, durationMinutes: 30 }];
    expect(readVerifiedCustomerQuoteLineItems({ lineItems: withOven }, 34000, 240, 0, 34000))
      .toEqual(withOven);
    expect(readVerifiedCustomerQuoteLineItems({ lineItems: withOven }, 31000, 210, 0, 31000))
      .toBeNull();
  });
  it("populates branch-scoped quote cards with the saved snapshot, not a new estimate", () => {
    const runtime = readFileSync(join(process.cwd(), "src/features/operations/operational-product-runtime.ts"),"utf8");
    expect(runtime).toContain('service.from("quotes").select("*").eq("workspace_id", workspace.id)');
    expect(runtime).toContain("lineItems: readVerifiedCustomerQuoteLineItems(");
    expect(runtime).toContain("row.snapshot, numberValue(row, \"subtotal_minor\")");
  });
  it("shows a real itemization and disables send until evidence and expiry are valid", () => {
    const ui = readFileSync(join(process.cwd(), "src/features/operations/OperationalProductRoute.tsx"),"utf8");
    expect(ui).toContain('aria-label="Verified saved quote charges"');
    expect(ui).toContain("formatMinorMoney(item.amountMinor, selectedQuote.currency)");
    expect(ui).toContain("Boolean(selectedQuote.lineItems?.length)");
    expect(ui).toContain('Date.parse(selectedQuote.validUntil ?? "") > Date.parse(data.loadedAt)');
    expect(ui).toContain("Do not send this quote");
    expect(ui).toContain('selectedQuote.status === "APPROVED" ? (');
  });
});
