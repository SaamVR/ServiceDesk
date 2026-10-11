import { describe, expect, it } from "vitest";
import { buildScheduleWindow, filterScheduleWindow, scheduleWindowFeedbackPrefix, scheduleWindowHref, shiftBusinessDay, validateScheduleDay } from "@/features/operations/staff-schedule-window";

describe("business-local dispatch week navigation", () => {
  const zone = "America/New_York";
  const now = "2026-03-07T20:00:00.000Z";
  it("uses calendar days across DST forward, not a 168-hour UTC offset", () => {
    const window = buildScheduleWindow(now,zone);
    expect(window).toMatchObject({from:"2026-03-07",end:"2026-03-13",until:"2026-03-14",next:"2026-03-14",previous:"2026-02-28",isCurrent:true});
    const input = [
      {startAt:"2026-03-14T03:30:00.000Z",status:"CONFIRMED",id:"last-night"},
      {startAt:"2026-03-14T04:30:00.000Z",status:"CONFIRMED",id:"after-midnight"},
      {startAt:"2026-03-08T07:30:00.000Z",status:"CANCELLED",id:"cancelled"},
    ];
    expect(filterScheduleWindow(input,zone,window).map(x=>x.id)).toEqual(["last-night"]);
  });
  it("rejects malformed and impossible dates without throwing or polluting URLs", () => {
    expect(validateScheduleDay("2026-02-30")).toBeUndefined();
    expect(validateScheduleDay("../../../")).toBeUndefined();
    expect(validateScheduleDay("2026-03-03")).toBe("2026-03-03");
    expect(buildScheduleWindow(now,zone,"2037-01-01").isCurrent).toBe(true);
    expect(shiftBusinessDay("2026-12-30",7)).toBe("2027-01-06");
  });
  it("preserves selected date and crew-filter across clicks and server-action feedback",()=>{
    const window=buildScheduleWindow(now,zone,"2026-03-14");
    expect(scheduleWindowHref(window.from,"unassigned",window.today)).toBe("?from=2026-03-14&queue=unassigned");
    expect(scheduleWindowFeedbackPrefix(window,"unassigned")).toBe("from=2026-03-14&queue=unassigned&");
    expect(scheduleWindowHref(window.today,"all",window.today)).toBe("?");
  });
  it("handles a fall-back DST calendar week without double counting",()=>{
    const fall=buildScheduleWindow("2026-11-01T17:00:00Z",zone,"2026-10-31");
    const result=filterScheduleWindow([
      {startAt:"2026-11-01T05:30:00Z",status:"IN_PROGRESS",id:"first-1-30"},
      {startAt:"2026-11-01T06:30:00Z",status:"IN_PROGRESS",id:"second-1-30"},
    ],zone,fall);
    expect(result.map(x=>x.id)).toEqual(["first-1-30","second-1-30"]);
  });
});
