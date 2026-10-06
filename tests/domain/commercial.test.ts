import { describe, expect, it } from "vitest";
import {
  assertCommercialAdjustmentRequest,
  assertCommercialEffectiveWindow,
  assertCommercialPortfolioRoles,
  assertCommercialServicePlan,
} from "../../src/domain/commercial";

describe("commercial contract domain guards", () => {
  it("accepts ordered effective windows and rejects reversed or malformed dates", () => {
    expect(() => assertCommercialEffectiveWindow("2026-10-01", "2027-09-30")).not.toThrow();
    expect(() => assertCommercialEffectiveWindow("2026-10-01")).not.toThrow();
    expect(() => assertCommercialEffectiveWindow("2026-10-05", "2026-10-04")).toThrow(/cannot precede/);
    expect(() => assertCommercialEffectiveWindow("10/01/2026")).toThrow(/ISO calendar date/);
  });

  it("requires at least one explicit portfolio-contact authority role", () => {
    expect(() => assertCommercialPortfolioRoles({ authorizedRequester: true, billingContact: false, operationsContact: false })).not.toThrow();
    expect(() => assertCommercialPortfolioRoles({ authorizedRequester: false, billingContact: false, operationsContact: false })).toThrow(/at least one commercial role/);
  });

  it("requires adjustment request fields to be complete and expressed in minor units", () => {
    expect(() => assertCommercialAdjustmentRequest({})).not.toThrow();
    expect(() => assertCommercialAdjustmentRequest({ kind: "CREDIT", amountMinor: 2500, currency: "USD" })).not.toThrow();
    expect(() => assertCommercialAdjustmentRequest({ kind: "CREDIT", amountMinor: 2500 })).toThrow(/supplied together/);
    expect(() => assertCommercialAdjustmentRequest({ kind: "CHARGE", amountMinor: 12.5, currency: "USD" })).toThrow(/positive integer/);
    expect(() => assertCommercialAdjustmentRequest({ kind: "CHARGE", amountMinor: 100, currency: "usd" as "USD" })).toThrow(/three-letter uppercase/);
  });

  it("uses the existing recurrence frequencies and validates local service windows", () => {
    expect(() => assertCommercialServicePlan({
      frequency: "MONTHLY",
      timezone: "America/New_York",
      localStartTime: "09:30",
      startsOn: "2026-10-01",
      preferredWindowStart: "09:00",
      preferredWindowEnd: "12:00",
    })).not.toThrow();

    expect(() => assertCommercialServicePlan({
      frequency: "WEEKLY",
      timezone: "Not/AZone",
      localStartTime: "09:30",
      startsOn: "2026-10-01",
    })).toThrow(/Invalid IANA timezone/);

    expect(() => assertCommercialServicePlan({
      frequency: "FORTNIGHTLY",
      timezone: "Europe/London",
      localStartTime: "09:30",
      startsOn: "2026-10-01",
      preferredWindowStart: "13:00",
      preferredWindowEnd: "12:00",
    })).toThrow(/must end after/);
  });
});
