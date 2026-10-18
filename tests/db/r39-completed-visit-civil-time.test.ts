import {describe,expect,it} from "vitest";
import {isVerifiedCompletedVisit} from "../../src/server/workflows/verified-visit-completion";
const now=Date.parse("2026-10-18T12:00:00.000Z");
const row={status:"COMPLETED",starts_at:"2026-10-18T08:00:00.000Z",
 ends_at:"2026-10-18T14:00:00.000Z"};
describe("SONIC R39 L16 civil-valid saved VISIT_COMPLETED milestone",()=>{
 it("permits early completion of a real visit, without requiring scheduled end already passed",()=>{
  expect(isVerifiedCompletedVisit(row,now)).toBe(true);
  expect(isVerifiedCompletedVisit({...row,status:"IN_PROGRESS"},now)).toBe(false);
  expect(isVerifiedCompletedVisit({...row,starts_at:"2026-10-18T12:00:01Z"},now)).toBe(false);
  expect(isVerifiedCompletedVisit({...row,ends_at:"2026-10-18T08:00:00.000Z"},now)).toBe(false);
 });
 it("never treats normalized invalid Gregorian dates or unbounded time zones as verified visits",()=>{
  for (const stamp of [
   "2026-02-30T08:00:00Z","2026-04-31T08:00:00Z",
   "2026-10-18T25:00:00Z","2026-10-18T03:61:00Z",
   "2026-10-18T08:00:00+14:30","2026-10-18T08:00:00-15:00",
   "2026-10-18T08:00:00","2026-10-18 08:00:00",
   "2026-10-18T08:00:00+00:60","2026-10-18T08:00:00Z\u202e",
  ]){
   expect(isVerifiedCompletedVisit({...row,starts_at:stamp},now),stamp).toBe(false);
   expect(isVerifiedCompletedVisit({...row,ends_at:stamp},now),stamp).toBe(false);
  }
 });
 it("accepts valid zoned PostgreSQL microsecond precision but not nonfinite now",()=>{
  const zoned={...row,starts_at:"2026-10-18T13:00:00.000001+06:00",
   ends_at:"2026-10-18T17:00:00.000001+06:00"};
  expect(isVerifiedCompletedVisit(zoned,now)).toBe(true);
  expect(isVerifiedCompletedVisit(zoned,NaN)).toBe(false);
  expect(isVerifiedCompletedVisit(zoned,Infinity)).toBe(false);
  expect(isVerifiedCompletedVisit(null as unknown as typeof row,now)).toBe(false);
 });
});
