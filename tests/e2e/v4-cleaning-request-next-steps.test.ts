import {describe,expect,test} from "vitest";
import {cleaningRequestNextSteps} from "../../src/features/operations/cleaning-request-next-steps";
const base={serviceActive:true,bedrooms:0,bathrooms:0,pricingState:"VERIFIED" as const};
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
test("a quote is not delivered merely because status says sent",()=>{
 const view=cleaningRequestNextSteps({...base,currentQuote:{status:"SENT",totalMinor:12000,currency:"USD"}});
 expect(view.complete).toBe(4);
 expect(view.steps.find(x=>x.id==="quote")?.detail).toContain("does not mean it was delivered");
});
test("invalid monetary or unsupported quote state fails closed",()=>{
 for(const currentQuote of [
 {status:"PENDING",totalMinor:2000,currency:"USD"},
 {status:"SENT",totalMinor:NaN,currency:"USD"},
 {status:"APPROVED",totalMinor:2000,currency:"GBP"},
 ]) expect(cleaningRequestNextSteps({...base,currentQuote}).complete).toBe(3);
});
});