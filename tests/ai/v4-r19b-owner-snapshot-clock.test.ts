import { describe, it, expect } from "vitest";
import { isFreshOwnerOperationsSnapshotAt } from "../../src/server/ai/owner-operations-brief";

const now=Date.parse("2026-10-17T07:00:00.000Z");
describe("R19 owner AI snapshot authority",()=>{
 it("accepts only civil-valid zoned fresh source receipts",()=>{
  for(const valid of ["2026-10-17T07:00:00Z",
    "2026-10-17T12:45:00.000000+05:45",
    "2026-10-17T06:30:00+00:00"]) {
    expect(isFreshOwnerOperationsSnapshotAt(valid,now),valid).toBe(true);
  }
 });
 it("refuses local-time, invalid zones, invalid calendar and poisoned source clocks",()=>{
  for(const bad of [null,undefined,{},false,0,
    "2026-10-17T07:00:00", "2026-10-17", "2026-10-17 07:00:00",
    "2026-10-17T07:00:00+14:01", "2026-10-17T07:00:00-14:30",
    "2026-10-17T07:00:00+15:00", "2026-10-17T07:00:00+00:60",
    "2026-02-30T07:00:00Z", "0000-10-17T07:00:00Z",
    "2026-10-17T07:00:00.1234567Z",
    "2026-10-17T07:00:00Z\u202e",
  ]) expect(isFreshOwnerOperationsSnapshotAt(bad,now),String(bad)).toBe(false);
 });
 it("rejects stale or far future receipts, and invalid comparison clocks",()=>{
  expect(isFreshOwnerOperationsSnapshotAt("2026-10-17T06:29:59Z",now)).toBe(false);
  expect(isFreshOwnerOperationsSnapshotAt("2026-10-17T07:05:01Z",now)).toBe(false);
  expect(isFreshOwnerOperationsSnapshotAt("2026-10-17T07:00:00Z",NaN)).toBe(false);
  expect(isFreshOwnerOperationsSnapshotAt("2026-10-17T07:00:00Z",Infinity)).toBe(false);
 });
});
