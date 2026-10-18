import {describe,expect,it} from "vitest";
import {loadAuthorizedOwnerFinanceReview,type AuthorizedFinanceReviewDependencies}
 from "../../src/server/ai/authorized-finance-review";
const loadedAt="2026-10-18T08:00:00.000Z",workspaceId="workspace-one";
function invoices(n:number){
 return Array.from({length:n},(_,i)=>({
  id:"invoice-"+String(i).padStart(3,"0"),workspaceId,
  status:"ISSUED",currency:"USD",totalMinor:100,
  allocatedMinor:0,refundedMinor:0,balanceMinor:100,
 }));
}
function deps(countFirst:number,countSecond:number=countFirst){
 let reads=0;
 const d={now:()=>Date.parse(loadedAt),
  loadSnapshot:async()=>{
   reads++;
   return {ok:true,value:{
    workspace:{id:workspaceId,slug:"qa-finance"},
    actor:{workspaceId,userId:"owner-one",role:"OWNER"},
    loadedAt,invoices:invoices(reads===1?countFirst:countSecond),
   }};
  },
 } as unknown as AuthorizedFinanceReviewDependencies;
 return {deps:d,reads:()=>reads};
}
describe("SONIC R38 owner finance source completeness",()=>{
 it("reads a complete saved invoice set twice before suggesting manual ledger review",async()=>{
   const d=deps(2);
   expect(await loadAuthorizedOwnerFinanceReview("qa-finance",d.deps))
    .toMatchObject({ok:true,value:{inspectedCount:2,exceptionCount:2,
      paymentConfirmed:false,providerMessageQueued:false,refundAuthorized:false}});
   expect(d.reads()).toBe(2);
 });
 it("fails closed on exactly the persisted-loader invoice 300-row cap",async()=>{
   const d=deps(300);
   expect(await loadAuthorizedOwnerFinanceReview("qa-finance",d.deps))
    .toMatchObject({ok:false,code:"FINANCE_SOURCE_INCOMPLETE"});
   expect(d.reads()).toBe(1);
 });
 it("rejects a second read at the limit even if the first looked complete",async()=>{
   const d=deps(299,300);
   expect(await loadAuthorizedOwnerFinanceReview("qa-finance",d.deps))
    .toMatchObject({ok:false,code:"FINANCE_SOURCE_INCOMPLETE"});
   expect(d.reads()).toBe(2);
 });
 it("rejects changed ledger identity and saved financial evidence between reads",async()=>{
   const d=deps(1,2);
   expect(await loadAuthorizedOwnerFinanceReview("qa-finance",d.deps))
    .toMatchObject({ok:false,code:"FINANCE_SAVED_STATE_CHANGED"});
 });
});
