import { describe, expect, it } from "vitest";
import type { VisitDTO } from "../../src/contracts";
import {
  formatOperationalTime,
  formatVisitWindow,
  isVisitOnOperationalDay,
  resolveOperationalTimeZone,
} from "../../src/features/crew/time-format";

const visit: VisitDTO = {
  id: "visit_1",
  workspaceId: "ws_1",
  requestId: "req_1",
  quoteId: "quote_1",
  crewId: "crew_1",
  status: "ASSIGNED",
  startAt: "2026-10-05T09:00:00.000Z",
  serviceMinutes: 120,
  bufferMinutes: 30,
  version: 3,
};

describe("crew operational timezone formatting", () => {
  it("uses the explicit workspace timezone for normal operating time", () => {
    const view = formatVisitWindow(visit, "Europe/London");
    expect(view.windowLabel).toBe("10:00–12:30");
    expect(view.timeZone).toBe("Europe/London");
    expect(view.timeZoneSource).toBe("WORKSPACE");
    expect(formatOperationalTime(visit.startAt, "Europe/London")).toBe("10:00");
  });

  it("preserves local wall-clock meaning across the DST spring transition", () => {
    const dstVisit = {
      ...visit,
      startAt: "2026-03-29T00:30:00.000Z",
      serviceMinutes: 120,
      bufferMinutes: 0,
    };
    const view = formatVisitWindow(dstVisit, "Europe/London");
    expect(view.windowLabel).toBe("00:30–03:30");
  });

  it("falls back explicitly to UTC when no valid workspace timezone is supplied", () => {
    expect(resolveOperationalTimeZone()).toEqual({ timeZone: "UTC", source: "FALLBACK_UTC" });
    expect(resolveOperationalTimeZone("Not/AZone")).toEqual({ timeZone: "UTC", source: "FALLBACK_UTC" });
    expect(formatVisitWindow(visit).windowLabel).toBe("09:00–11:30");
  });

  it("uses the operational timezone, not browser locale, for Today filtering", () => {
    const nearMidnight = { ...visit, startAt: "2026-10-04T23:30:00.000Z" };
    expect(isVisitOnOperationalDay(nearMidnight, "2026-10-05T00:15:00.000Z", "Europe/London")).toBe(true);
    expect(isVisitOnOperationalDay(nearMidnight, "2026-10-05T00:15:00.000Z", "UTC")).toBe(false);
  });
});
