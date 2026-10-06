import { describe, expect, it } from "vitest";
import {
  assertCommercialBillingPeriod,
  resolveCommercialFixedPerVisitRate,
} from "../../src/domain/commercial";

describe("commercial consolidated billing domain", () => {
  it("accepts an ordered ISO billing period and rejects reversed or malformed windows", () => {
    expect(() => assertCommercialBillingPeriod({ periodStart: "2026-10-01", periodEnd: "2026-10-31" })).not.toThrow();
    expect(() => assertCommercialBillingPeriod({ periodStart: "2026-10-31", periodEnd: "2026-10-01" })).toThrow(/cannot precede/);
    expect(() => assertCommercialBillingPeriod({ periodStart: "10\/01\/2026", periodEnd: "2026-10-31" })).toThrow(/ISO calendar dates/);
  });

  it("uses an explicit site fixed-per-visit override before the contract rate", () => {
    expect(resolveCommercialFixedPerVisitRate(
      { billingModel: "FIXED_PER_VISIT", amountMinor: 12500 },
      { billingModel: "FIXED_PER_VISIT", amountMinor: 15000 },
    )).toEqual({ billingModel: "FIXED_PER_VISIT", amountMinor: 15000 });
  });

  it("fails closed for unsupported or unsafe rate snapshots", () => {
    expect(() => resolveCommercialFixedPerVisitRate({ billingModel: "HOURLY", amountMinor: 5000 })).toThrow(/FIXED_PER_VISIT/);
    expect(() => resolveCommercialFixedPerVisitRate({ billingModel: "FIXED_PER_VISIT", amountMinor: 0 })).toThrow(/positive integer/);
    expect(() => resolveCommercialFixedPerVisitRate({ billingModel: "FIXED_PER_VISIT", amountMinor: 12.5 })).toThrow(/positive integer/);
  });
});
