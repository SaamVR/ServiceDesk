import {describe,expect,it} from "vitest";
import {loadAuthorizedOwnerFinanceReview, type AuthorizedFinanceReviewDependencies}
 from "../../src/server/ai/authorized-finance-review";
const ts="2026-10-18T04:00:00.000Z",workspaceId="workspace-a";
const sample=()=>({
 workspace:{id:workspaceId,slug:"qa-cleaning"},
 actor:{workspaceId,userId:"owner-a",role:"OWNER"},
 loadedAt:ts,
 invoices:[{id:"invoice-a",workspaceId,status:"ISSUED",currency:"USD",
  totalMinor:1000,allocatedMinor:0,refundedMinor:0,balanceMinor:1000}],
});
function deps(input:{roleAfter?:string;ownerAfter?:string;invoiceAfter?:number;throwAfter?:boolean}={}){
 let n=0;
 return {loadSnapshot:async ()=>{
   n++;if(n===2&&input.throwAfter)throw Error("no live connection");
   return {ok:true,value:{
     ...sample(),actor:{...sample().actor,
       role:n>1?(input.roleAfter??"OWNER"):"OWNER",
       userId:n>1?(input.ownerAfter??"owner-a"):"owner-a"},
     invoices:[{...sample().invoices[0],balanceMinor:
       n>1?(input.invoiceAfter??1000):1000}],
   }};
 },now:()=>Date.parse(ts)} as unknown as AuthorizedFinanceReviewDependencies;
}
describe("SONIC R35 authorized owner invoice anomaly reader",()=>{
 it("reads two matching saved owner snapshots and returns no payment or contact authority",async()=>{
   const r=await loadAuthorizedOwnerFinanceReview("qa-cleaning",deps());
   expect(r).toMatchObject({ok:true,value:{
    source:"AUTHORIZED_SAVED_INVOICE_SNAPSHOT",
    exceptionCount:1,exceptions:[{invoiceId:"invoice-a",codes:["ISSUED_BALANCE_REVIEW"]}],
    paymentConfirmed:false,providerMessageQueued:false,refundAuthorized:false,
   }});
   expect(JSON.stringify(r)).not.toContain("1000");
 });
 it("refuses changed saved invoice money or revoked owner context after first read",async()=>{
   expect(await loadAuthorizedOwnerFinanceReview("qa-cleaning",deps({invoiceAfter:900})))
     .toMatchObject({ok:false,code:"FINANCE_SAVED_STATE_CHANGED"});
   expect(await loadAuthorizedOwnerFinanceReview("qa-cleaning",deps({roleAfter:"DISPATCHER"})))
     .toMatchObject({ok:false,code:"FINANCE_OWNER_REQUIRED"});
   expect(await loadAuthorizedOwnerFinanceReview("qa-cleaning",deps({ownerAfter:"owner-b"})))
     .toMatchObject({ok:false,code:"FINANCE_OWNER_REQUIRED"});
 });
 it("fails safe on an unavailable second source read and malformed slug",async()=>{
   expect(await loadAuthorizedOwnerFinanceReview("qa-cleaning",deps({throwAfter:true})))
     .toMatchObject({ok:false,code:"FINANCE_SNAPSHOT_UNAVAILABLE"});
   expect(await loadAuthorizedOwnerFinanceReview("../other",deps()))
     .toMatchObject({ok:false,code:"FINANCE_INPUT_INVALID"});
 });
});
