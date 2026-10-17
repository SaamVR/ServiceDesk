import { describe, expect, it } from "vitest";
import { defaultRateCard } from "../../src/domain/quote";
import { diagnoseSavedBranchPricing } from "../../src/features/operations/owner-pricing-revision-diagnosis";

const valid = {
  branchCurrency: "USD", startsAt: null, endsAt: null, serviceCatalogComplete: true,
  now: Date.parse("2026-10-17T08:00:00Z"),
  card: {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    active: true, version: "owner-cleaning-v3", currency: "USD",
    deposit_percent: 25, valid_hours: 48, buffer_minutes: 30,
    rules: {
      autoApprovalMaxTotalMinor: defaultRateCard.autoApprovalMaxTotalMinor,
      standard: defaultRateCard.standard,
      deep: defaultRateCard.deep,
      moveOut: defaultRateCard.moveOut,
    },
  },
};
describe("R25 saved owner pricing repair diagnosis", () => {
  it("explains quote-source-valid current pricing without claiming a quote", () => {
    expect(diagnoseSavedBranchPricing(valid)).toMatchObject({
      code: "CURRENT_SAVED_PRICING", state: "READY_CANDIDATE",
    });
  });
  it("blocks a missing card, invalid rules or different currency", () => {
    expect(diagnoseSavedBranchPricing({...valid, card: null}).code).toBe("RATE_CARD_MISSING");
    expect(diagnoseSavedBranchPricing({...valid,
      card: {...valid.card, rules:{standard:{baseMinor:10}}}}).code).toBe("RATE_CARD_INVALID");
    expect(diagnoseSavedBranchPricing({...valid,
      card: {...valid.card,currency:"GBP"}}).code).toBe("RATE_CURRENCY_MISMATCH");
    expect(diagnoseSavedBranchPricing({...valid,
      card: {...valid.card,active:false}}).code).toBe("RATE_CARD_INVALID");
  });
  it("does not label impossible dates or expired/future books usable", () => {
    for (const startsAt of ["2026-02-30T00:00:00Z","2026-10-17",{},undefined]) {
      expect(diagnoseSavedBranchPricing({...valid, startsAt}).code).toBe("WINDOW_INVALID");
    }
    expect(diagnoseSavedBranchPricing({...valid, startsAt:"2030-01-01T00:00:00Z"}).code).toBe("NOT_EFFECTIVE");
    expect(diagnoseSavedBranchPricing({...valid, endsAt:"2020-01-01T00:00:00Z"}).code).toBe("NOT_EFFECTIVE");
    expect(diagnoseSavedBranchPricing({...valid, startsAt:"2026-11-01T00:00:00Z",
      endsAt:"2026-10-01T00:00:00Z"}).code).toBe("WINDOW_INVALID");
  });
  it("does not silently repair a shared workspace service catalog", () => {
    expect(diagnoseSavedBranchPricing({...valid,serviceCatalogComplete:false}))
      .toMatchObject({state:"REPAIR_REQUIRED",code:"NO_ACTIVE_CATALOG"});
  });
});
