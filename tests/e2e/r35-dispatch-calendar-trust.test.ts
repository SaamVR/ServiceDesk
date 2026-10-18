import { describe, expect, it } from "vitest";
import {
  buildDispatchCoverageWeek, scheduleCoverageHref, isValidCoverageDay,
} from "../../src/features/operations/dispatch-coverage-week";

describe("R35 genuine business-local dispatch dates", () => {
  it("rejects invalid Gregorian days including normalized overflow and misleading query dates", () => {
    const invalid = ["2026-02-29", "2026-02-30", "2026-04-31", "2026-13-01",
      "2026-00-01", "2026-01-00", "0000-02-29", "2026-01-1", "2026-01-01Z",
      "2026-01-01?queue=all"];
    for (const d of invalid) {
      expect(isValidCoverageDay(d)).toBe(false);
      expect(scheduleCoverageHref("unassigned", d, d, "2026-01-01"))
        .toBe("?queue=unassigned");
    }
    expect(isValidCoverageDay("2024-02-29")).toBe(true);
    expect(isValidCoverageDay("2000-02-29")).toBe(true);
    expect(isValidCoverageDay("1900-02-29")).toBe(false);
    expect(isValidCoverageDay(undefined)).toBe(false);
  });
  it("fails closed on invalid timezone, invalid snapshot clock, and invalid explicit start", () => {
    const visit = [{ status: "CONFIRMED", startAt: "2026-10-18T09:00:00Z" }];
    expect(buildDispatchCoverageWeek(visit,"2026-10-18T07:00:00Z","Invalid/TZ"))
      .toEqual([]);
    expect(buildDispatchCoverageWeek(visit,"2026-02-30T07:00:00Z","UTC"))
      .toEqual([]);
    expect(buildDispatchCoverageWeek(visit,"2026-10-18T07:00:00","UTC"))
      .toEqual([]);
    expect(buildDispatchCoverageWeek(visit,"2026-10-18T07:00:00Z","UTC","2026-02-30"))
      .toEqual([]);
    expect(buildDispatchCoverageWeek(visit,"2026-10-18T07:00:00Z","UTC","2024-02-29"))
      .toHaveLength(7);
  });
  it("ignores visit timestamps that JS normalizes but the saved instant contract rejects", () => {
    const visits = [
      { status:"CONFIRMED", startAt:"2026-10-18T09:00:00Z", crewId:"crew1" },
      { status:"CONFIRMED", startAt:"2026-10-18T10:00:00", crewId:undefined },
      { status:"CONFIRMED", startAt:"2026-10-32T10:00:00Z" },
      { status:"CONFIRMED", startAt:"2026-02-30T10:00:00Z" },
      { status:"CANCELLED", startAt:"2026-10-18T08:00:00Z" },
    ];
    const days=buildDispatchCoverageWeek(visits,"2026-10-18T07:00:00Z","UTC");
    expect(days).toHaveLength(7);
    expect(days[0]).toMatchObject({key:"2026-10-18",total:1,unassigned:0});
  });
  it("preserves years 1 through 99 without Date.UTC's 1900 alias", () => {
    const days=buildDispatchCoverageWeek([],"2026-10-18T06:00:00Z","UTC","0001-01-01");
    expect(days).toHaveLength(7);
    expect(days[0].key).toBe("0001-01-01");
    expect(days[6].key).toBe("0001-01-07");
    expect(buildDispatchCoverageWeek([],"2026-10-18T06:00:00Z","UTC","0099-12-27")[0].key)
      .toBe("0099-12-27");
  });
  it("does not emit impossible expanded calendar keys near year 10000", () => {
    expect(buildDispatchCoverageWeek([],"2026-10-18T06:00:00Z","UTC","9999-12-30"))
      .toEqual([]);
    expect(buildDispatchCoverageWeek([],"2026-10-18T06:00:00Z","UTC","9999-12-24"))
      .toHaveLength(7);
  });

  it("preserves valid filtered selection only for a real civil day", () => {
    expect(scheduleCoverageHref("unassigned","2026-02-28","2026-02-21","2026-02-19"))
      .toBe("?from=2026-02-21&queue=unassigned&day=2026-02-28");
  });
});
