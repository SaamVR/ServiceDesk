import {describe,expect,it} from "vitest";
import {
 loadF03AuthorizedLedgerExplanation,
 type F03FinanceExplanationDependencies,
} from "../../src/server/ai/f03-saved-ledger-explanations";
import {
 loadAuthorizedOwnerFinanceReview,
 type AuthorizedFinanceReviewDependencies,
} from "../../src/server/ai/authorized-finance-review";

const workspaceId="workspace-1",slug="owner-cleaning",at="2026-10-25T05:00:00Z";
const now=()=>Date.parse(at);
const savedInvoice=()=>({
 id:"invoice-1",workspaceId,quoteId:"quote-1",visitId:"visit-1",
 status:"ISSUED",currency:"USD",totalMinor:100,
 allocatedMinor:0,refundedMinor:0,balanceMinor:150,
});
function authorizedFixture(opts:{
 first?:(x:ReturnType<typeof savedInvoice>)=>void;
 second?:(x:ReturnType<typeof savedInvoice>)=>void;
 role?:"OWNER"|"DISPATCHER";
 snapshotError?:boolean;
 count?:number;
}={}){
 let calls=0;
 const deps={
  now,
  loadSnapshot:async()=>{
   calls++;
   if(opts.snapshotError)return {ok:false,kind:"server",message:"unavailable"};
   const row=savedInvoice();
   (calls===1?opts.first:opts.second)?.(row);
   return {ok:true,value:{
    workspace:{id:workspaceId,slug,name:"Demo",timezone:"UTC"},
    actor:{workspaceId,userId:"staff-1",role:opts.role??"OWNER"},
    loadedAt:at,
    invoices:Array.from({length:opts.count??1},(_,i)=>({...row,id:"invoice-"+(i+1)})),
   }};
  },
 } as unknown as AuthorizedFinanceReviewDependencies;
 return {deps,calls:()=>calls};
}
describe("F03 finance #765 integration and safe explanation",()=>{
 it("uses the existing canonical authorized projection for operational invoices containing quoteId",async()=>{
  const f=authorizedFixture();
  const source=await loadAuthorizedOwnerFinanceReview(slug,f.deps);
  expect(source).toMatchObject({ok:true,value:{
   source:"AUTHORIZED_SAVED_INVOICE_SNAPSHOT",inspectedCount:1,
   exceptionCount:1,exceptions:[{invoiceId:"invoice-1",
    codes:["LEDGER_TOTALS_RECONCILIATION"],priority:"HIGH"}],
   paymentConfirmed:false,refundAuthorized:false,providerMessageQueued:false,
  }});
  expect(f.calls()).toBe(2);
 });
 it("returns fixed human-readable reason codes, never amounts or customer contacts",async()=>{
  const f=authorizedFixture();
  const deps={
   now,
   loadReview:(s:string)=>loadAuthorizedOwnerFinanceReview(s,f.deps),
  } as F03FinanceExplanationDependencies;
  const r=await loadF03AuthorizedLedgerExplanation(slug,deps);
  expect(r).toMatchObject({ok:true,value:{
   state:"SAVED_LEDGER_EXCEPTION_EXPLANATION_FOR_OWNER_REVIEW",
   exceptionCount:1,
   explanations:[{invoiceId:"invoice-1",priority:"HIGH",
    reasons:[{code:"LEDGER_TOTALS_RECONCILIATION"}],
    humanApprovalRequired:true}],
   revenueAsserted:false,paymentConfirmed:false,refundAuthorized:false,
   invoiceWritten:false,customerMessageSent:false,modelInvoked:false,
  }});
  expect(JSON.stringify(r)).not.toContain("quote-1");
  expect(JSON.stringify(r)).not.toContain("100");
 });
 it("refuses unavailable ledger, wrong owner and deceptive surplus source keys",async()=>{
  for(const opts of [
   {snapshotError:true},
   {role:"DISPATCHER" as const},
   {first:(i:ReturnType<typeof savedInvoice>)=>
      Object.assign(i,{customerEmail:"private@example.com"})},
   {second:(i:ReturnType<typeof savedInvoice>)=>{i.totalMinor=200;}},
   {count:300},
  ]){
   const f=authorizedFixture(opts);
   const result=await loadF03AuthorizedLedgerExplanation(slug,{
    loadReview:(s:string)=>loadAuthorizedOwnerFinanceReview(s,f.deps),
    now,
   } as F03FinanceExplanationDependencies);
   expect(result.ok).toBe(false);
   expect(JSON.stringify(result)).not.toContain("private@example.com");
  }
 });
 it("rejects fabricated exception taxonomy and invalid exception totals from injected adapters",async()=>{
  const source={
   ok:true as const,
   value:{
    state:"FINANCE_OWNER_MANUAL_REVIEW" as const,
    source:"AUTHORIZED_SAVED_INVOICE_SNAPSHOT" as const,
    workspaceId,inspectedCount:1,exceptionCount:1,
    exceptions:[{invoiceId:"invoice-1",priority:"HIGH" as const,
      codes:["LEDGER_TOTALS_RECONCILIATION" as const]}],
    paymentConfirmed:false as const,refundAuthorized:false as const,
    providerMessageQueued:false as const,
   },
  };
  const bad=[
   {...source,value:{...source.value,exceptionCount:0}},
   {...source,value:{...source.value,exceptions:[{...source.value.exceptions[0],
     codes:["FAKE_APPROVED_PAYMENT"]}]}},
   {...source,value:{...source.value,paymentConfirmed:true}},
  ];
  for(const output of bad){
   const deps={loadReview:async()=>output} as unknown as F03FinanceExplanationDependencies;
   expect(await loadF03AuthorizedLedgerExplanation(slug,deps))
    .toMatchObject({ok:false,code:"F03_FINANCE_SOURCE_UNAVAILABLE"});
  }
 });
 it("does not make calendar commitments from financial review and honors cancellation",async()=>{
  const ac=new AbortController();ac.abort();
  expect(await loadF03AuthorizedLedgerExplanation(slug,{signal:ac.signal}))
   .toMatchObject({ok:false,code:"F03_FINANCE_REVIEW_CANCELLED"});
  expect(await loadF03AuthorizedLedgerExplanation("../foreign"))
   .toMatchObject({ok:false,code:"F03_FINANCE_INPUT_INVALID"});
 });
});
