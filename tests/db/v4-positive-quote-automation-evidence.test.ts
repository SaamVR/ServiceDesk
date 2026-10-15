import { describe, expect, test } from "vitest";
import { isVerifiedAcceptedQuoteMilestone } from "../../src/server/workflows/accepted-quote-milestone";

const accepted = {
  status: "ACCEPTED", currency: "USD", subtotal_minor: 24000, tax_minor: 0,
  total_minor: 24000, deposit_minor: 6000, balance_minor: 18000,
  duration_minutes: 120,
  snapshot: { lineItems: [
    { code: "BASE", description: "Cleaning service", amountMinor: 24000, durationMinutes: 120 },
  ] },
};

describe("accepted commercial quote owner automation", () => {
  test("permits an actual reconciled, positive saved owner price", () => {
    expect(isVerifiedAcceptedQuoteMilestone(accepted)).toBe(true);
  });
  test("rejects fake zero-priced accepted snapshots before owner workflow execution", () => {
    const zero = {
      ...accepted, subtotal_minor: 0, total_minor: 0,
      deposit_minor: 0, balance_minor: 0,
      snapshot: { lineItems: [
        { code: "BASE", description: "Cleaning service", amountMinor: 0, durationMinutes: 120 },
      ] },
    };
    expect(isVerifiedAcceptedQuoteMilestone(zero)).toBe(false);
    expect(isVerifiedAcceptedQuoteMilestone({ ...zero, status: "DRAFT" })).toBe(false);
  });
  test("does not accept paid-looking quote totals with inconsistent charges", () => {
    expect(isVerifiedAcceptedQuoteMilestone({ ...accepted, total_minor: 25000 })).toBe(false);
    expect(isVerifiedAcceptedQuoteMilestone({ ...accepted, deposit_minor: 6001 })).toBe(false);
    expect(isVerifiedAcceptedQuoteMilestone({ ...accepted, snapshot: null })).toBe(false);
  });
});
