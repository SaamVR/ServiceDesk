import {describe, expect, it} from "vitest";
import {buildStaffQuoteChecklist, type StaffQuoteChecklistFacts}
  from "../../src/features/operations/staff-quote-checklist";
import {hasCurrentSavedQuoteExpiry} from "../../src/features/operations/quote-validity-clock";
const now="2026-10-17T10:00:00Z";
const fixture: StaffQuoteChecklistFacts={
  status:"APPROVED",validUntil:"2026-10-20T10:00:00Z",currency:"USD",
  subtotalMinor:10000,taxMinor:500,totalMinor:10500,depositMinor:2100,
  balanceMinor:8400,durationMinutes:90,
  lineItems:[{code:"STANDARD",description:"Standard cleaning",amountMinor:10000,durationMinutes:90}]
};
describe("R21 practical staff-send quote clock agreement",()=>{
  it("never marks an impossible calendar or zoned timestamp as send-ready",()=>{
    const invalid=[
      "2026-02-30T10:00:00Z","2026-04-31T10:00:00Z",
      "2025-02-29T10:00:00Z","2026-10-20T25:00:00Z",
      "2026-10-20T10:60:00Z","2026-10-20T10:00:60Z",
      "2026-10-20T10:00:00+14:01","2026-10-20T10:00:00+15:00",
      "2026-10-20T10:00:00+03:60","2026-10-20T10:00:00",
      "2026-10-20T10:00:00Z\u202E",
    ];
    for(const validUntil of invalid){
      const check=buildStaffQuoteChecklist({...fixture,validUntil},now);
      expect(check.readyForHumanReview,validUntil).toBe(false);
      expect(check.items.find(x=>x.key==="validity")?.state).toBe("REVIEW");
      expect(hasCurrentSavedQuoteExpiry(now,validUntil)).toBe(false);
    }
  });
  it("agrees with customer acceptance on valid offsets, leap days and microseconds",()=>{
    const deadlines=[
      "2028-02-29T10:00:00.123456Z",
      "2026-10-20T16:00:00+06:00",
      "2026-10-20T10:00:00.123456Z",
    ];
    for(const validUntil of deadlines){
      const check=buildStaffQuoteChecklist({...fixture,validUntil},now);
      expect(check.readyForHumanReview).toBe(true);
      expect(check.items.find(x=>x.key==="validity")?.state).toBe("PASS");
      expect(hasCurrentSavedQuoteExpiry(now,validUntil)).toBe(true);
      expect(check.items.find(x=>x.key==="delivery")?.state).toBe("MANUAL");
    }
  });
  it("refuses an offer at its exact expiry and when the current clock is invalid",()=>{
    const expiry="2026-10-17T10:00:00Z";
    expect(buildStaffQuoteChecklist({...fixture,validUntil:expiry},now).readyForHumanReview).toBe(false);
    expect(buildStaffQuoteChecklist(fixture,"2026-02-30T09:00:00Z").readyForHumanReview).toBe(false);
    expect(buildStaffQuoteChecklist(fixture,"2026-10-17T10:00:00+99:00").readyForHumanReview).toBe(false);
  });
});