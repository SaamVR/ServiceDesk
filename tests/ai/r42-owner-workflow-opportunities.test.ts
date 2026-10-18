import {ownerPriorityActions} from "../../src/server/ai/owner-priority-actions";
import {describe,expect,it} from "vitest";
import {suggestOwnerAutomationOpportunities,type OwnerAutomationOpportunityDependencies}
 from "../../src/server/ai/owner-automation-opportunities";
const ws="11111111-1111-4111-8111-111111111111";
const branch="22222222-2222-4222-8222-222222222222";
const slug="qa-cleaning";
const facts={
 openRequests:5,waitingOnCustomerQuotes:0,quoteValidityNeedsReview:0,
 collectibleInvoices:3,invoiceLedgersNeedingReview:0,unassignedActiveVisits:0,
 unresolvedCriticalAttentions:2,
};
const priorities=ownerPriorityActions(facts,7)!;
function rig(options:{role?:string;revoked?:boolean;branchValid?:boolean;
  changeSource?:boolean}={}){
 let reads=0,checks=0;
 const resolveActor=async()=>{
   reads++;return {ok:true,value:{
    workspace:{id:ws,slug},actor:{workspaceId:ws,userId:"owner-1",
      role:options.revoked&&reads===2?"CREW":options.role??"OWNER"},
    service:{},
   }};
 };
 const verifyBranch=async()=>{checks++;return options.branchValid!==false;};
 const loadWorkday=async()=>({ok:true,value:{
   state:"VERIFIED_OWNER_WORKDAY_REVIEW",
   source:options.changeSource?"SYNTHETIC_ONLY":"DOUBLE_CHECKED_SAVED_WORKSPACE_COUNTS",
   workspaceId:ws,facts,priorities,
 }});
 const deps={resolveActor,verifyBranch,loadWorkday} as unknown as OwnerAutomationOpportunityDependencies;
 return {deps,reads:()=>reads,checks:()=>checks};
}
describe("SONIC R42 L18 owner backlog to future rule opportunity",()=>{
 it("maps only semantically correct future triggers and refuses retrospective execution",async()=>{
  const q=rig();
  const r=await suggestOwnerAutomationOpportunities(slug,branch,q.deps);
  expect(r).toMatchObject({ok:true,value:{inspectedPriorities:3,skippedPriorities:1,
    modelInvoked:false,published:false,providerMessagesSent:false,
    suggestions:[
     {evidenceKey:"CRITICAL_ATTENTION",savedCount:2,target:"FUTURE_ATTENTION_OPENED",
      draft:{eventType:"ATTENTION_OPENED",published:false,actions:[{type:"CREATE_ATTENTION"}]},
      existingCasesProcessed:false,requiresOwnerApproval:true},
     {evidenceKey:"OPEN_REQUEST",savedCount:5,target:"FUTURE_REQUEST_CREATED",
      draft:{eventType:"REQUEST_CREATED",published:false,actions:[{type:"CREATE_ATTENTION"}]},
      existingCasesProcessed:false},
    ]}});
  expect(q.reads()).toBe(2);expect(q.checks()).toBe(2);
 });
 it("denies missing branch authority, revoked owner and unverified workday source",async()=>{
  for(const o of [{branchValid:false},{revoked:true},{role:"DISPATCHER"},{changeSource:true}]){
   const q=rig(o);const r=await suggestOwnerAutomationOpportunities(slug,branch,q.deps);
   expect(r.ok).toBe(false);
  }
 });
 it("never maps collectible invoices into a fake invoice-paid event",async()=>{
   const q=rig();
   const r=await suggestOwnerAutomationOpportunities(slug,branch,q.deps);
   expect(JSON.stringify(r)).not.toContain("INVOICE_PAID");
   expect(JSON.stringify(r)).not.toContain("SEND_WHATSAPP_TEMPLATE");
 });
 it("rejects invalid workspaces and branch refs without touching provider",async()=>{
  const q=rig();
  expect(await suggestOwnerAutomationOpportunities("invalid slug",branch,q.deps))
   .toMatchObject({ok:false,code:"OPPORTUNITY_INPUT_INVALID"});
  expect(await suggestOwnerAutomationOpportunities(slug,"bad-branch",q.deps))
   .toMatchObject({ok:false,code:"OPPORTUNITY_INPUT_INVALID"});
  expect(q.reads()).toBe(0);
 });
});
