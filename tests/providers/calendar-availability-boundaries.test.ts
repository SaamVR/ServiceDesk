import { describe, expect, test } from "vitest";
import { calendarSlotOverlapsBusy, expandCalendarSlotWithBuffer, filterAvailableCalendarSlots } from "../../src/server/integrations/google-calendar/availability";
import type { CalendarBusyRange } from "../../src/server/integrations";

const busy = (startAt: string, endAt: string): CalendarBusyRange => ({
  calendarId: "crew-1",
  startAt,
  endAt,
  source: "EXTERNAL_BUSY",
  freshness: "FRESH",
});

describe("Calendar availability boundary checks", () => {
  test("detects overlap across spring-forward DST gap using real instants, not local text comparison", () => {
    const springForwardBusy = busy("2026-03-08T01:30:00-05:00", "2026-03-08T03:30:00-04:00");

    expect(calendarSlotOverlapsBusy({ startAt: "2026-03-08T07:00:00.000Z", endAt: "2026-03-08T07:30:00.000Z" }, springForwardBusy)).toBe(true);
    expect(calendarSlotOverlapsBusy({ startAt: "2026-03-08T07:30:00.000Z", endAt: "2026-03-08T08:00:00.000Z" }, springForwardBusy)).toBe(false);
  });

  test("does not confuse repeated fall-back hours with different UTC offsets", () => {
    const firstRepeatedHourBusy = busy("2026-11-01T01:15:00-04:00", "2026-11-01T01:45:00-04:00");

    expect(calendarSlotOverlapsBusy({ startAt: "2026-11-01T01:20:00-04:00", endAt: "2026-11-01T01:40:00-04:00" }, firstRepeatedHourBusy)).toBe(true);
    expect(calendarSlotOverlapsBusy({ startAt: "2026-11-01T01:20:00-05:00", endAt: "2026-11-01T01:40:00-05:00" }, firstRepeatedHourBusy)).toBe(false);
  });

  test("treats exact midnight boundary touching as available", () => {
    const midnightBusy = busy("2026-10-05T00:00:00.000Z", "2026-10-05T01:00:00.000Z");

    expect(calendarSlotOverlapsBusy({ startAt: "2026-10-04T23:00:00.000Z", endAt: "2026-10-05T00:00:00.000Z" }, midnightBusy)).toBe(false);
    expect(calendarSlotOverlapsBusy({ startAt: "2026-10-05T01:00:00.000Z", endAt: "2026-10-05T02:00:00.000Z" }, midnightBusy)).toBe(false);
  });

  test("applies service buffer before overlap filtering", () => {
    const slot = expandCalendarSlotWithBuffer(
      { startAt: "2026-10-05T09:00:00.000Z", endAt: "2026-10-05T10:00:00.000Z" },
      { beforeMinutes: 15, afterMinutes: 30 },
    );

    expect(slot).toEqual({ startAt: "2026-10-05T08:45:00.000Z", endAt: "2026-10-05T10:30:00.000Z" });
    expect(calendarSlotOverlapsBusy(slot, busy("2026-10-05T10:15:00.000Z", "2026-10-05T10:45:00.000Z"))).toBe(true);
  });

  test("filters available slots against fresh external busy ranges only", () => {
    const slots = [
      { id: "slot-open", startAt: "2026-10-05T08:00:00.000Z", endAt: "2026-10-05T09:00:00.000Z" },
      { id: "slot-blocked", startAt: "2026-10-05T09:30:00.000Z", endAt: "2026-10-05T10:30:00.000Z" },
    ];
    const result = filterAvailableCalendarSlots(slots, [busy("2026-10-05T09:45:00.000Z", "2026-10-05T10:00:00.000Z")], { beforeMinutes: 0, afterMinutes: 0 });

    expect(result.map((slot) => slot.id)).toEqual(["slot-open"]);
  });
});
