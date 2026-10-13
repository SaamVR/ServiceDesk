import { describe, expect, test } from "vitest";
import { listCalendarBusyWithFreshness } from "../../src/server/integrations/google-calendar/adapter";
import type { CalendarAdapter, CalendarBusyRange } from "../../src/server/integrations/types";
import type { GoogleCalendarConnectionPolicy } from "../../src/server/integrations/google-calendar/oauth";

const policy: GoogleCalendarConnectionPolicy = {
  workspaceId: "workspace-fixture", crewId: "crew-fixture",
  calendarId: "calendar-fixture", status: "CONNECTED",
  canReadBusy: true, canCreateEvents: true,
};
const good: CalendarBusyRange = {
  calendarId: "calendar-fixture", source: "EXTERNAL_BUSY", freshness: "FRESH",
  startAt: "2026-10-14T08:00:00Z", endAt: "2026-10-14T09:00:00Z",
};
const range={from:"2026-10-14T00:00:00Z",to:"2026-10-15T00:00:00Z"};

function fakeAdapter(run:()=>Promise<unknown>):CalendarAdapter {
  return { listBusy: run } as unknown as CalendarAdapter;
}
describe("Google Calendar busy provider freshness boundary",()=>{
  test("returns no instant confirmation after a thrown adapter",async()=>{
    const value=await listCalendarBusyWithFreshness(fakeAdapter(async()=>{
      throw new Error("private token and provider body must never leak");
    }),policy,range,policy.crewId);
    expect(value).toMatchObject({ok:true,value:{
      availabilityFresh:false,instantConfirmationAllowed:false,reason:"CALENDAR_BUSY_LOOKUP_FAILED",
      busy:[],
    }});
    expect(JSON.stringify(value)).not.toContain("private token");
  });
  test("rejects invalid or timezone-ambiguous busy data as provider error",async()=>{
    const patches=[
      {startAt:"ambiguous"}, {endAt:"2026-10-14T07:00:00Z"},
      {startAt:"2026-10-14T08:00:00"},{freshness:"UNKNOWN"},
      {source:"OTHER"}, {calendarId:""},
    ];
    for(const patch of patches){
      const value=await listCalendarBusyWithFreshness(
        fakeAdapter(async()=>({ok:true,value:[{...good,...patch}]})),
        policy,range,policy.crewId,
      );
      expect(value).toMatchObject({ok:true,value:{
        availabilityFresh:false,instantConfirmationAllowed:false,reason:"CALENDAR_BUSY_LOOKUP_FAILED",
      }});
    }
  });
  test("allows a verified feed, but stale feed still requires refresh",async()=>{
    const fresh=await listCalendarBusyWithFreshness(
      fakeAdapter(async()=>({ok:true,value:[good]})),policy,range,policy.crewId);
    expect(fresh).toMatchObject({ok:true,value:{availabilityFresh:true,instantConfirmationAllowed:true}});
    const stale=await listCalendarBusyWithFreshness(
      fakeAdapter(async()=>({ok:true,value:[{...good,freshness:"STALE"}]})),policy,range,policy.crewId);
    expect(stale).toMatchObject({ok:true,value:{
      availabilityFresh:false,instantConfirmationAllowed:false,reason:"CALENDAR_STALE_REQUIRES_REFRESH",
    }});
  });
});
