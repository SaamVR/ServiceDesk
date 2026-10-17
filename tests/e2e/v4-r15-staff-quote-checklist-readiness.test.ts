import {describe,expect,it} from "vitest";
import {buildStaffQuoteChecklist, type StaffQuoteChecklistFacts}
  from "../../src/features/operations/staff-quote-checklist";
const now="2026-10-17T10:00:00Z";
const quote:StaffQuoteChecklistFacts={
 status:"APPROVED",validUntil:"2026-10-20T10:00:00Z",
 currency:"USD",subtotalMinor:10000,taxMinor:500,totalMinor:10500,
 depositMinor:2100,balanceMinor:8400,durationMinutes:90,
 lineItems:[{code:"STANDARD",description:"Standard cleaning",amountMinor:10000,durationMinutes:90}],
};
describe("R15 saved staff quote review correctness",()=>{
 it("permits a nonzero exact, unexpired saved quote but does not certify delivery",()=>{
  const result=buildStaffQuoteChecklist(quote,now);
  expect(result.readyForHumanReview).toBe(true);
  expect(result.items.find(x=>x.key==="charges")?.state).toBe("PASS");
  expect(result.items.find(x=>x.key==="delivery")?.state).toBe("MANUAL");
 });
 it("rejects zero-money and zero-duration quotes even when line snapshots mathematically agree",()=>{
  const free:StaffQuoteChecklistFacts={...quote,subtotalMinor:0,taxMinor:0,totalMinor:0,
    depositMinor:0,balanceMinor:0,durationMinutes:0,
    lineItems:[{code:"STANDARD",description:"Standard cleaning",amountMinor:0,durationMinutes:0}]};
  for(const variant of [free,{...quote,durationMinutes:0,
      lineItems:[{code:"STANDARD",description:"Standard cleaning",amountMinor:10000,durationMinutes:0}]}]){
    const result=buildStaffQuoteChecklist(variant,now);
    expect(result.readyForHumanReview).toBe(false);
    expect(result.items.find(x=>x.key==="charges")?.state).toBe("REVIEW");
  }
 });
 it("rejects timezone-ambiguous validity dates and expired quotes",()=>{
  for(const validUntil of ["2026-10-20T10:00:00","2026-10-17T09:59:59Z",
      "tomorrow","2026-10-20", "2026-10-20T10:00:00+99:00"]){
    expect(buildStaffQuoteChecklist({...quote,validUntil},now).readyForHumanReview).toBe(false);
  }
  expect(buildStaffQuoteChecklist(quote,"2026-10-17T10:00:00").readyForHumanReview).toBe(false);
 });
});
