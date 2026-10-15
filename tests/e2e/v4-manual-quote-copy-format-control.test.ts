import { describe, expect, test } from "vitest";
import { verifiedManualQuoteHandoffMessage } from "../../src/features/operations/quote-manual-handoff";

const base = {
  quoteId: "11111111-1111-4111-8111-111111111111",
  status: "SENT", currency: "USD", validUntil: "2030-01-01T00:00:00Z",
  subtotalMinor: 10000, taxMinor: 0, totalMinor: 10000,
  depositMinor: 2500, balanceMinor: 7500, durationMinutes: 60,
  lineItems: [{ code: "BASE", description: "Kitchen cleaning", amountMinor: 10000, durationMinutes: 60 }],
};

describe("manual outbound quote text is readable and price-bound", () => {
  test("preserves ordinary customer-visible service descriptions", () => {
    const result = verifiedManualQuoteHandoffMessage(base, "https://example.com", new Date("2026-10-15T00:00:00Z"));
    expect(result).toContain("Kitchen cleaning — $100.00");
  });
  test("refuses hidden directional overrides and invisible format controls", () => {
    const examples = [
      "\u202E", // Unicode right-to-left override
      "\u202C", // pop directional formatting
      "\u2066", // left-to-right isolate
      "\u2069", // pop directional isolate
      "\u200B", // zero-width space
      "\u200D", // zero-width joiner
      "\uFEFF", // byte-order mark / zero-width no-break
    ];
    for (const mark of examples) {
      const facts = { ...base, lineItems: [{
        ...base.lineItems[0], description: "Kitchen" + mark + " cleaning",
      }] };
      expect(verifiedManualQuoteHandoffMessage(
        facts, "https://example.com", new Date("2026-10-15T00:00:00Z"),
      )).toBeNull();
    }
  });
});