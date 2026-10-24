import {describe,expect,it} from "vitest";
import {loadAuthorizedOwnerFinanceReview, type AuthorizedFinanceReviewDependencies}
 from "../../src/server/ai/authorized-finance-review";

const loadedAt="2026-10-25T00:00:00.000Z";
const invoice=()=>({
 id:"invoice-1",workspaceId:"workspace-a",quoteId:"quote-1",visitId:undefined,
 status:"ISSUED",currency:"USD",totalMinor:1000,allocatedMinor:0,
 refundedMinor:0,balanceMinor:1000,
});
// The invoice object reproduces the enumerable fields returned by the real
// operational mapInvoice, including quoteId/visitId. This is a contract test,
// not a claim of live database acceptance.
function source(config:{
 first?:unknown[];second?:unknown[];secondOwner?:string;secondRole?:string;
}={}) {
 let reads=0;
 const dependencies={
  now:()=>Date.parse(loadedAt),
  loadSnapshot:async()=>{
   reads++;
   return {ok:true,value:{
     workspace:{id:"workspace-a",slug:"owner-finance"},
     actor:{workspaceId:"workspace-a",userId:reads===1?"owner-a":
       (config.secondOwner??"owner-a"),role:reads===2?
       (config.secondRole??"OWNER"):"OWNER"},
     loadedAt,invoices:reads===1?(config.first??[invoice()]):
       (config.second??[invoice()]),
   }};
  },
 } as unknown as AuthorizedFinanceReviewDependencies;
 return {dependencies,reads:()=>reads};
}
const review=async (s:ReturnType<typeof source>)=>
 loadAuthorizedOwnerFinanceReview("owner-finance",s.dependencies);

describe("R45 authorized finance projection of actual operational invoice contract",()=>{
 it("accepts mapped quoteId only through strict redacted projection and compares two reads",async()=>{
   const s=source();
   const result=await review(s);
   expect(result).toMatchObject({ok:true,value:{
     source:"AUTHORIZED_SAVED_INVOICE_SNAPSHOT",inspectedCount:1,
     exceptionCount:1,exceptions:[{invoiceId:"invoice-1",
       codes:["ISSUED_BALANCE_REVIEW"]}],
     paymentConfirmed:false,refundAuthorized:false,providerMessageQueued:false,
   }});
   expect(s.reads()).toBe(2);
   expect(JSON.stringify(result)).not.toContain("quote-1");
   expect(JSON.stringify(result)).not.toContain("1000");
 });
 it("does not silently project injected customer, provider or payment authority",async()=>{
   for(const forbidden of [
     {customerEmail:"private@example.test"},
     {paymentStatus:"VERIFIED"},
     {providerMessageSent:true},
     {paymentIntentId:"payment-claimed"},
   ]){
     const s=source({first:[{...invoice(),...forbidden}]});
     expect(await review(s)).toMatchObject({ok:false,
       code:"FINANCE_SNAPSHOT_UNAVAILABLE"});
     expect(s.reads()).toBe(1);
   }
 });
 it("rejects hidden fields, getters, inherited rows and symbol evidence",async()=>{
   const hidden=Object.defineProperty(invoice(),"customerPhone",{
     enumerable:false,value:"private-customer",
   });
   const accessor=Object.defineProperty(invoice(),"status",{
     enumerable:true,get(){throw Error("must not read customer data");},
   });
   const inherited=Object.assign(Object.create({paymentConfirmed:true}),invoice());
   const symbolRow={...invoice(),[Symbol("secret")]:"customer secret"};
   for(const row of [hidden,accessor,inherited,symbolRow]){
     expect(await review(source({first:[row]}))).toMatchObject({
       ok:false,code:"FINANCE_SNAPSHOT_UNAVAILABLE"});
   }
 });
 it("fails closed for foreign invoice, different owner or role on reread",async()=>{
   expect(await review(source({first:[{...invoice(),workspaceId:"workspace-b"}]})))
     .toMatchObject({ok:false,code:"FINANCE_SNAPSHOT_UNAVAILABLE"});
   expect(await review(source({secondOwner:"owner-b"})))
     .toMatchObject({ok:false,code:"FINANCE_OWNER_REQUIRED"});
   expect(await review(source({secondRole:"DISPATCHER"})))
     .toMatchObject({ok:false,code:"FINANCE_OWNER_REQUIRED"});
 });
 it("rejects drift in quote identity, ledger amounts and later injected fields",async()=>{
   expect(await review(source({second:[{...invoice(),quoteId:"quote-2"}]})))
     .toMatchObject({ok:false,code:"FINANCE_SAVED_STATE_CHANGED"});
   expect(await review(source({second:[{...invoice(),balanceMinor:900}]})))
     .toMatchObject({ok:false,code:"FINANCE_SAVED_STATE_CHANGED"});
   expect(await review(source({second:[{...invoice(),paymentStatus:"PAID"}]})))
     .toMatchObject({ok:false,code:"FINANCE_SAVED_STATE_CHANGED"});
 });
 it("treats a saturated invoice source page as incomplete, not zero exceptions",async()=>{
   const rows=Array.from({length:300},(_,n)=>({...invoice(),id:"invoice-"+n}));
   const s=source({first:rows});
   expect(await review(s)).toMatchObject({ok:false,code:"FINANCE_SOURCE_INCOMPLETE"});
   expect(s.reads()).toBe(1);
 });
 it("permits genuinely empty, twice-read invoices without inventing payments",async()=>{
   const result=await review(source({first:[],second:[]}));
   expect(result).toMatchObject({ok:true,value:{
     inspectedCount:0,exceptionCount:0,paymentConfirmed:false,
     refundAuthorized:false,providerMessageQueued:false,
   }});
 });
});
