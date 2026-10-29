import {describe,expect,it} from "vitest";
import {proposeF04SavedRetentionReview,type F04RetentionDependencies} from "../../src/server/ai/f04-saved-retention-review";
const work="workspace-1",slug="cleaning-demo",at="2026-10-25T06:00:00Z",
  now=()=>Date.parse(at),branch="branch-1";
const req=(id:string,cid:string)=>({id,branchId:branch,customerId:cid,
  status:"BOOKED",serviceLabel:"PRIVATE SERVICE NAME",version:2,
  createdAt:"2026-07-01T06:00:00Z"});
const visit=(id:string,reqId:string,startAt:string,status="COMPLETED")=>({
 id,workspaceId:work,branchId:branch,requestId:reqId,quoteId:"quote-1",
 status,version:3,startAt,serviceMinutes:60,bufferMinutes:15,
});
function snapshot(){
 return {
  loadedAt:at,retentionAvailable:true,
  workspace:{id:work,slug,name:"Private Workspace",timezone:"UTC"},
  actor:{userId:"owner-1",workspaceId:work,role:"OWNER"},
  branchScope:{mode:"ALL",branches:[{id:branch,code:"MAIN",name:"Main",
    timezone:"UTC",currency:"USD",isDefault:true}]},
  customers:[{id:"customer-1",displayName:"PRIVATE PERSON"},
    {id:"customer-2",displayName:"PRIVATE OTHER PERSON"}],
  requests:[req("request-1","customer-1"),req("request-2","customer-2")],
  visits:[visit("visit-1","request-1","2026-10-05T06:00:00Z"),
   visit("visit-2","request-1","2026-09-10T06:00:00Z"),
   visit("visit-3","request-2","2026-08-01T06:00:00Z")],
  recurrenceRules:[],
  communicationConsents:[
   {customerId:"customer-1",channel:"EMAIL",status:"GRANTED",
    purpose:"FOLLOW_UP",recordedAt:"2026-10-01T06:00:00Z"},
   {customerId:"customer-2",channel:"WHATSAPP",status:"GRANTED",
    purpose:"RETENTION",recordedAt:"2026-10-02T06:00:00Z"},
  ],
  retentionControls:[
   {customerId:"customer-1",channel:"EMAIL",status:"ACTIVE",version:2},
   {customerId:"customer-2",channel:"WHATSAPP",status:"ACTIVE",version:5},
  ],
 };
}
type S=ReturnType<typeof snapshot>;
function fixture(opts:{first?:(s:S)=>void;second?:(s:S)=>void;unavailable?:boolean}={}){
 let reads=0;
 const deps={now,loadSnapshot:async()=>{
   reads++;
   if(opts.unavailable)return {ok:false,kind:"server",message:"unavailable"};
   const s=structuredClone(snapshot());(reads===1?opts.first:opts.second)?.(s);
   return {ok:true,value:s};
 }} as unknown as F04RetentionDependencies;
 return {deps,reads:()=>reads};
}
const run=(deps:F04RetentionDependencies)=>proposeF04SavedRetentionReview(slug,deps);
describe("F04 retention from persisted history: manual only, never predictive churn",()=>{
 it("proposes repeat cleaning and service-gap reviews only from saved completed visits and consent",async()=>{
  const f=fixture(),r=await run(f.deps);
  expect(r).toMatchObject({ok:true,value:{
   state:"SAVED_HISTORY_RETENTION_REVIEW_ONLY",
   source:"DOUBLE_READ_SAVED_VISITS_REQUESTS_AND_EXPLICIT_OPT_IN",
   candidates:[
    {customerId:"customer-1",channel:"EMAIL",kind:"REPEAT_CLEANING_REVIEW",
     lastCompletedVisitId:"visit-1",savedCompletedVisitCount:2,
     manualContactAndPurposeRevalidationRequired:true,
     customerContactSent:false,outreachScheduled:false},
    {customerId:"customer-2",channel:"WHATSAPP",
     kind:"SERVICE_GAP_REVIEW_NOT_CHURN_PROOF",lastCompletedVisitId:"visit-3",
     retentionControlVersion:5,customerContactSent:false,outreachScheduled:false},
   ],
   sourceCompletenessUnverified:true,churnProven:false,staffApprovalRequired:true,
   noAutonomousSend:true,paymentChanged:false,modelInvoked:false,
   businessStateMutated:false,
  }});
  expect(f.reads()).toBe(2);
  expect(JSON.stringify(r)).not.toContain("PRIVATE PERSON");
  expect(JSON.stringify(r)).not.toContain("PRIVATE SERVICE");
 });
 it("suppresses revoked, unknown and wrong-purpose channel grants and opt-outs",async()=>{
  const mutations=[
   (s:S)=>{s.communicationConsents[0].status="REVOKED";},
   (s:S)=>{s.communicationConsents[0].status="UNKNOWN";},
   (s:S)=>{s.communicationConsents[0].purpose="SUPPORT";},
   (s:S)=>{s.retentionControls[0].status="SUPPRESSED";},
   (s:S)=>{s.retentionControls[0].status="PAUSED";},
   (s:S)=>{s.retentionControls=s.retentionControls.slice(1);},
  ];
  for(const patch of mutations){
   const r=await run(fixture({first:patch,second:patch}).deps);
   expect(r).toMatchObject({ok:true,value:{candidates:[{
    customerId:"customer-2",channel:"WHATSAPP",
   }]}});
  }
 });
 it("never suggests outreach for future booked visit, active recurrence, too recent or too old history",async()=>{
  const patches=[
   (s:S)=>{s.visits.push(visit("visit-next","request-1",
     "2026-11-02T06:00:00Z","CONFIRMED"));},
   (s:S)=>{s.recurrenceRules.push({id:"recurrence-1",branchId:branch,
     requestId:"request-1",propertyId:"property-1",status:"ACTIVE",version:1,
     frequency:"MONTHLY"} as never);},
   (s:S)=>{s.visits[0].startAt="2026-10-24T06:00:00Z";
     s.visits[1].startAt="2026-10-20T06:00:00Z";},
   (s:S)=>{s.visits[0].startAt="2025-10-01T06:00:00Z";
     s.visits[1].startAt="2025-09-01T06:00:00Z";},
  ];
  for(const patch of patches){
   const r=await run(fixture({first:patch,second:patch}).deps);
   expect(r).toMatchObject({ok:true,value:{candidates:[{
    customerId:"customer-2",channel:"WHATSAPP",
   }]}});
  }
 });
 it("rejects latest consent, control or visit-history changes between two source reads",async()=>{
  const changes=[
   (s:S)=>{s.communicationConsents[0].status="REVOKED";},
   (s:S)=>{s.communicationConsents[0].recordedAt="2026-10-10T06:00:00Z";},
   (s:S)=>{s.retentionControls[0].version=3;},
   (s:S)=>{s.retentionControls[0].status="SUPPRESSED";},
   (s:S)=>{s.visits[0].version=4;},
   (s:S)=>{s.visits[0].status="IN_PROGRESS";},
   (s:S)=>{s.requests[0].customerId="customer-2";},
   (s:S)=>{s.actor.userId="owner-foreign";},
  ];
  for(const patch of changes)
   expect(await run(fixture({second:patch}).deps))
    .toMatchObject({ok:false,code:"F04_RETENTION_SOURCE_CHANGED"});
 });
 it("rejects foreign rows, forged source completeness, duplicate consent, bad dates or unauthorized role",async()=>{
  const cases=[
   (s:S)=>{s.actor.workspaceId="foreign";},
   (s:S)=>{s.actor.role="DISPATCHER";},
   (s:S)=>{s.branchScope.mode="BRANCH";},
   (s:S)=>{s.requests[0].customerId="customer-foreign";},
   (s:S)=>{s.visits[0].workspaceId="foreign";},
   (s:S)=>{s.visits[0].startAt="2026-02-30T06:00:00Z";},
   (s:S)=>{s.loadedAt="2026-10-24T05:00:00Z";},
   (s:S)=>{s.communicationConsents.push({...s.communicationConsents[0]});},
   (s:S)=>{s.retentionControls.push({...s.retentionControls[0]});},
   (s:S)=>{s.retentionAvailable=false;},
   (s:S)=>{s.visits=Array.from({length:300},(_,i)=>visit("v-"+i,"request-1",at));},
  ];
  for(const patch of cases)expect((await run(fixture({first:patch}).deps)).ok).toBe(false);
  expect(await run(fixture({unavailable:true}).deps))
    .toMatchObject({ok:false,code:"F04_RETENTION_SOURCE_UNAVAILABLE"});
 });
 it("cancels before source read and refuses bad workspace identifiers",async()=>{
  const c=new AbortController();c.abort();const f=fixture();
  expect(await run({...f.deps,signal:c.signal}))
   .toMatchObject({ok:false,code:"F04_RETENTION_CANCELLED"});
  expect(f.reads()).toBe(0);
  expect(await proposeF04SavedRetentionReview("../bad"))
   .toMatchObject({ok:false,code:"F04_RETENTION_INPUT_INVALID"});
 });
});
