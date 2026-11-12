import {describe,expect,it} from "vitest";
import {
 loadF03SavedDailyWeeklyIntelligence,
 type F03SavedIntelligenceDependencies,
} from "../../src/server/ai/f03-saved-daily-weekly-intelligence";

const workspaceId="workspace-1",slug="owner-cleaning",
 at="2026-10-25T05:00:00Z",now=()=>Date.parse(at),branchId="branch-1";
const request=(id:string,createdAt:string)=>({
 id,branchId,customerId:"customer-private",serviceLabel:"PRIVATE NAME",
 status:"READY",version:1,createdAt,
});
const visit=(id:string,startAt:string,status="CONFIRMED")=>({
 id,branchId,workspaceId,requestId:"request-1",quoteId:"quote-1",
 status,version:1,startAt,serviceMinutes:60,bufferMinutes:15,
});
type S=ReturnType<typeof snapshot>;
function snapshot(){
 return {
  loadedAt:at,
  workspace:{id:workspaceId,slug,name:"PRIVATE WORKSPACE",timezone:"UTC"},
  actor:{workspaceId,userId:"owner-1",role:"OWNER"},
  branchScope:{mode:"ALL",branches:[{id:branchId,code:"MAIN",name:"Branch",
   timezone:"UTC",currency:"USD",isDefault:true}]},
  requests:[
   request("request-1","2026-10-25T03:00:00Z"),
   request("request-2","2026-10-22T03:00:00Z"),
   request("request-3","2026-10-11T03:00:00Z"),
  ],
  visits:[
   visit("visit-1","2026-10-25T03:30:00Z"),
   visit("visit-2","2026-10-23T10:00:00Z","COMPLETED"),
   visit("visit-3","2026-10-24T13:00:00Z","CANCELLED"),
  ],
 };
}
function fixture(opts:{
 first?:(s:S)=>void;second?:(s:S)=>void;denied?:boolean;
}={}){
 let calls=0;
 const deps={
  now,
  loadSnapshot:async()=>{
   calls++;
   if(opts.denied)return {ok:false,kind:"authorization",message:"denied"};
   const s=structuredClone(snapshot());
   (calls===1?opts.first:opts.second)?.(s);
   return {ok:true,value:s};
  },
 } as unknown as F03SavedIntelligenceDependencies;
 return {deps,calls:()=>calls};
}
const run=(d:F03SavedIntelligenceDependencies)=>loadF03SavedDailyWeeklyIntelligence(slug,d);
describe("F03 source-bound UTC daily/weekly BI without invented finance or deadlines",()=>{
 it("counts only real persisted request creation and noncancelled visit start records",async()=>{
  const t=fixture(),r=await run(t.deps);
  expect(r).toMatchObject({ok:true,value:{
   state:"AUTHORIZED_SAVED_DAILY_WEEKLY_OPERATIONS_REVIEW",
   source:"DOUBLE_READ_BOUNDED_AUTHORIZED_REQUEST_VISIT_ROWS",
   sourceClock:at,
   timeBasis:"UTC_CIVIL_DAYS_NO_DEADLINE_INFERENCE",
   daily:{utcDay:"2026-10-25",createdRequestRecords:1,nonCancelledVisitStartRecords:1},
   weekly:{fromUtcDay:"2026-10-19",throughUtcDay:"2026-10-25",
    createdRequestRecords:2,nonCancelledVisitStartRecords:2},
   historicalCompletenessUnverified:true,revenueUnavailable:true,paymentSettlementUnverified:true,
   deadlinesUnavailable:true,financialAmountsAsserted:false,
   messagesSent:false,businessStateMutated:false,modelInvoked:false,
   manualReviewRequired:true,
  }});
  if(r.ok){
   expect(r.value.weekly.days).toHaveLength(7);
   expect(r.value.weekly.days[3]).toMatchObject({utcDay:"2026-10-22",createdRequestRecords:1});
  }
  expect(t.calls()).toBe(2);
  expect(JSON.stringify(r)).not.toContain("PRIVATE");
  expect(JSON.stringify(r)).not.toContain("customer-private");
 });
 it("returns zero observed counts for empty loaded arrays without a whole-history claim",async()=>{
  const empty=(s:S)=>{s.requests=[];s.visits=[];};
  const r=await run(fixture({first:empty,second:empty}).deps);
  expect(r).toMatchObject({ok:true,value:{weekly:{
   createdRequestRecords:0,nonCancelledVisitStartRecords:0,
  },revenueUnavailable:true}});
 });
 it("denies stale identity, branch scope, incomplete page, missing request date and invalid timestamps",async()=>{
  const cases=[
   (s:S)=>{s.actor.role="DISPATCHER";},
   (s:S)=>{s.actor.workspaceId="foreign";},
   (s:S)=>{s.loadedAt="2026-10-23T05:00:00Z";},
   (s:S)=>{s.requests[0].branchId="foreign";},
   (s:S)=>{s.visits[0].branchId="foreign";},
   (s:S)=>{s.requests[0].createdAt="2026-02-30T05:00:00Z";},
   (s:S)=>{s.requests[0].createdAt="2026-10-28T05:00:00Z";},
   (s:S)=>{s.visits[0].startAt="2026-02-30T05:00:00Z";},
   (s:S)=>{s.requests[0].createdAt=undefined as unknown as string;},
   (s:S)=>{s.requests=Array.from({length:300},(_,i)=>request("r-"+i,at));},
   (s:S)=>{s.visits=Array.from({length:300},(_,i)=>visit("v-"+i,at));},
   (s:S)=>{s.requests.push({...s.requests[0]});},
  ];
  for(const mutate of cases)expect((await run(fixture({first:mutate}).deps)).ok).toBe(false);
  expect((await run(fixture({denied:true}).deps)).ok).toBe(false);
 });
 it("rejects forged record changes between two authorized saved snapshots",async()=>{
  const scenarios=[
   (s:S)=>{s.requests[0].version=2;},
   (s:S)=>{s.requests[0].status="QUOTED";},
   (s:S)=>{s.requests[0].createdAt="2026-10-24T03:00:00Z";},
   (s:S)=>{s.visits[0].status="COMPLETED";},
   (s:S)=>{s.visits[0].startAt="2026-10-24T03:30:00Z";},
   (s:S)=>{s.actor.userId="different-owner";},
  ];
  for(const mutate of scenarios)
   expect((await run(fixture({second:mutate}).deps)).ok).toBe(false);
 });
 it("refuses unsafe slug and cancellation before any snapshot read",async()=>{
  expect(await loadF03SavedDailyWeeklyIntelligence("../foreign"))
   .toMatchObject({ok:false,code:"F03_BI_INPUT_INVALID"});
  const abort=new AbortController();abort.abort();
  const f=fixture();
  expect(await loadF03SavedDailyWeeklyIntelligence(slug,{...f.deps,signal:abort.signal}))
   .toMatchObject({ok:false,code:"F03_BI_CANCELLED"});
  expect(f.calls()).toBe(0);
 });
});
