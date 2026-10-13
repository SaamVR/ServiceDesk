import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { readVerifiedCustomerQuoteLineItems } from "../../src/features/operations/customer-quote-line-items";

const base = [
  { code: "BASE", description: "Base service", amountMinor: 18000, durationMinutes: 120 },
  { code: "BEDROOM", description: "3 bedroom(s)", amountMinor: 9000, durationMinutes: 60 },
  { code: "BATHROOM", description: "2 bathroom(s)", amountMinor: 4000, durationMinutes: 30 },
];
const oven = { code: "OVEN", description: "Oven add-on", amountMinor: 3000, durationMinutes: 30 };

describe("customer quote saved itemization", () => {
  test("shows original persisted service lines only when their amounts and minutes reconcile", () => {
    expect(readVerifiedCustomerQuoteLineItems({ lineItems: base }, 31000, 210)).toEqual(base);
    expect(readVerifiedCustomerQuoteLineItems({ lineItems: [...base, oven] }, 34000, 240))
      .toEqual([...base, oven]);
    expect(readVerifiedCustomerQuoteLineItems({ lineItems: [...base, oven] }, 31000, 210))
      .toBeNull();
  });

  test("never invents or silently fixes missing, tampered or unsafe itemized amounts", () => {
    expect(readVerifiedCustomerQuoteLineItems(null, 31000, 210)).toBeNull();
    expect(readVerifiedCustomerQuoteLineItems({ lineItems: [] }, 31000, 210)).toBeNull();
    expect(readVerifiedCustomerQuoteLineItems({ lineItems: base }, 31001, 210)).toBeNull();
    expect(readVerifiedCustomerQuoteLineItems({ lineItems: base }, 31000, 211)).toBeNull();
    expect(readVerifiedCustomerQuoteLineItems({
      lineItems: [{ ...base[0], code: "<script>" }],
    }, 18000, 120)).toBeNull();
    expect(readVerifiedCustomerQuoteLineItems({
      lineItems: [{ ...base[0], amountMinor: -1 }],
    }, 18000, 120)).toBeNull();
    expect(readVerifiedCustomerQuoteLineItems({
      lineItems: [{ ...base[0], description: "Bad" + String.fromCharCode(10) + "item" }],
    }, 18000, 120)).toBeNull();
    expect(readVerifiedCustomerQuoteLineItems({ lineItems: Array.from({ length: 26 }, () => base[0]) }, 468000, 3120))
      .toBeNull();
  });

  test("wires saved snapshot only inside the existing tenant/customer-scoped query", () => {
    const runtime = readFileSync(join(process.cwd(),
      "src/features/operations/customer-product-runtime.ts"), "utf8");
    const ui = readFileSync(join(process.cwd(),
      "src/features/operations/CustomerProductRoute.tsx"), "utf8");
    expect(runtime).toContain('eq("customer_id", customer.id)');
    expect(runtime).toContain('.in("request_id", requestIds)');
    expect(runtime).toContain("readVerifiedCustomerQuoteLineItems(");
    expect(runtime).toContain("row.snapshot, quote.subtotalMinor, quote.durationMinutes");
    expect(ui).toContain("Verified saved quote line items");
    expect(ui).toContain("What your quote includes");
    expect(ui).toContain("Saved quote breakdown could not be verified");
    expect(ui).toContain("formatMinorMoney(line.amountMinor, quote.currency)");
  });
});
