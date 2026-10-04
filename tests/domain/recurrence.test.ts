import { describe, expect, it } from "vitest";
import { localDateTimeToUtcIso, nextRecurrenceDate } from "../../src/domain/recurrence";

describe("authoritative recurrence date engine", () => {
  it("uses local calendar days for weekly and fortnightly recurrence", () => {
    expect(nextRecurrenceDate({ current: "2026-03-07", frequency: "WEEKLY" })).toBe("2026-03-14");
    expect(nextRecurrenceDate({ current: "2026-03-07", frequency: "FORTNIGHTLY" })).toBe("2026-03-21");
  });

  it("preserves monthly anchor day and clamps shorter months", () => {
    expect(nextRecurrenceDate({ current: "2026-01-31", frequency: "MONTHLY", anchorDay: 31 })).toBe("2026-02-28");
    expect(nextRecurrenceDate({ current: "2026-02-28", frequency: "MONTHLY", anchorDay: 31 })).toBe("2026-03-31");
  });

  it("handles leap-year February", () => {
    expect(nextRecurrenceDate({ current: "2028-01-31", frequency: "MONTHLY", anchorDay: 31 })).toBe("2028-02-29");
    expect(nextRecurrenceDate({ current: "2028-02-29", frequency: "MONTHLY", anchorDay: 31 })).toBe("2028-03-31");
  });

  it("converts local time through IANA timezone rules instead of naive millisecond arithmetic", () => {
    expect(localDateTimeToUtcIso("2026-03-07", "09:30", "America/New_York")).toBe("2026-03-07T14:30:00.000Z");
    expect(localDateTimeToUtcIso("2026-03-14", "09:30", "America/New_York")).toBe("2026-03-14T13:30:00.000Z");
  });
});
