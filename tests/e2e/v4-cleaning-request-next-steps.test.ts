import {describe,expect,test} from "vitest";
import {cleaningRequestNextSteps} from "../../src/features/operations/cleaning-request-next-steps";
const base={serviceActive:true,bedrooms:0,bathrooms:0,pricingState:"VERIFIED" as const,asOf:"2026-10-16T12:00:00Z"};
describe("saved cleaning request action checklist",()=>{
test("confirmed zero room counts are valid",()=>{
 const view=cleaningRequestNextSteps(base);
 expect(view.quoteReady).toBe(true);
 expect(view.complete).toBe(3);
});
test("unverified rates and missing rooms do not authorize quote claims",()=>{
 const view=cleaningRequestNextSteps({...base,bathrooms:undefined,pricingState:"UNVERIFIED"});
 expect(view.quoteReady).toBe(false);
 expect(view.steps.find(x=>x.id==="pricing")?.state).toBe("UNVERIFIED");
});
const verifiedQuote = {
  status:"SENT", totalMinor:12000, currency:"USD", validUntil:"2026-10-20T12:00:00Z",
  subtotalMinor:12000, taxMinor:0, depositMinor:3000,
  balanceMinor:9000, durationMinutes:90,
  lineItems:[{code:"BASE",description:"Saved cleaning",amountMinor:12000,durationMinutes:90}],
};
test("a quote is not delivered merely because status says sent",()=>{
 const view=cleaningRequestNextSteps({...base,currentQuote:verifiedQuote});
 expect(view.complete).toBe(4);
 expect(view.steps.find(x=>x.id==="quote")?.detail).toContain("does not mean it was delivered");
});
test("an unverified quote status and total are not counted as completed financial proof",()=>{
  for(const currentQuote of [
    {status:"SENT",totalMinor:12000,currency:"USD"},
    {...verifiedQuote, depositMinor:2999},
    {...verifiedQuote, lineItems:[{...verifiedQuote.lineItems[0],amountMinor:11000}]},
    {...verifiedQuote, lineItems:null},
    {...verifiedQuote, subtotalMinor:11999},
  ]) {
    const view=cleaningRequestNextSteps({...base,currentQuote});
    expect(view.complete).toBe(3);
    expect(view.steps.find(x=>x.id==="quote")?.state).toBe("UNVERIFIED");
    expect(view.steps.find(x=>x.id==="quote")?.detail).toContain("do not reconcile");
  }
});
test("invalid monetary or unsupported quote state fails closed",()=>{
 for(const currentQuote of [
 {status:"PENDING",totalMinor:2000,currency:"USD"},
 {status:"SENT",totalMinor:NaN,currency:"USD"},
 {status:"APPROVED",totalMinor:2000,currency:"GBP"},
 ]) expect(cleaningRequestNextSteps({...base,currentQuote}).complete).toBe(3);
});
test("terminal quote records require replacement even with reconciled saved amounts",()=>{
 for(const status of ["DECLINED","REJECTED","EXPIRED","SUPERSEDED"]) {
  const view=cleaningRequestNextSteps({...base,currentQuote:{...verifiedQuote,status}});
  expect(view.complete).toBe(3);
  expect(view.quoteReady).toBe(true); // the request can be used to prepare a NEW quote
  expect(view.steps.find(x=>x.id==="quote")?.state).toBe("ACTION_REQUIRED");
  expect(view.steps.find(x=>x.id==="quote")?.detail).toContain("no longer actionable");
 }
 expect(cleaningRequestNextSteps({...base,currentQuote:{...verifiedQuote,status:"ACCEPTED"}}).complete).toBe(4);
});
test("approved and sent offers require a strictly future persisted validity timestamp",()=>{
 for(const status of ["SENT","APPROVED"]) {
  for(const validUntil of [undefined,"","not-an-instant","2026-10-16T11:59:59Z","2026-10-16T12:00:00Z"]) {
    const view=cleaningRequestNextSteps({...base,currentQuote:{...verifiedQuote,status,validUntil}});
    expect(view.quoteReady, String(validUntil)).toBe(true);
    expect(view.complete, status+" "+validUntil).toBe(3);
    expect(view.steps.find(x=>x.id==="quote")?.state).toBe("ACTION_REQUIRED");
    expect(view.steps.find(x=>x.id==="quote")?.detail).toContain("expired or its validity is unverified");
  }
  const future=cleaningRequestNextSteps({...base,currentQuote:{...verifiedQuote,status,validUntil:"2026-10-16T12:00:01Z"}});
  expect(future.complete).toBe(4);
 }
});
test("accepted quote stays completed after its offer validity elapsed",()=>{
 const accepted=cleaningRequestNextSteps({...base,currentQuote:{...verifiedQuote,status:"ACCEPTED",validUntil:"2026-10-15T12:00:00Z"}});
 expect(accepted.steps.find(x=>x.id==="quote")?.state).toBe("DONE");
});
test("an invalid staff-read time cannot make an offer appear verified",()=>{
 const view=cleaningRequestNextSteps({...base,asOf:"invalid",currentQuote:verifiedQuote});
 expect(view.steps.find(x=>x.id==="quote")?.state).toBe("ACTION_REQUIRED");
});

});