import {describe,expect,it} from "vitest";
import {suggestOwnerAutomationOpportunities,type OwnerAutomationOpportunityDependencies}
 from "../../src/server/ai/owner-automation-opportunities";
const ws="11111111-1111-4111-8111-111111111111";
const branch="22222222-2222-4222-8222-222222222222";
const slug="qa-cleaning";
const priorities=[
 {key:"CRITICAL_ATTENTION",count:2,source:"VERIFIED_SAVED_QUEUE_COUNT"},
 {key:"OPEN_REQUEST",count:5,source:"VERIFIED_SAVED_QUEUE_COUNT"},
 {key:"COLLECTIBLE_INVOICE",count:3,source:"VERIFIED_SAVED_QUEUE_COUNT"},
];
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
   workspaceId:ws,priorities,
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
