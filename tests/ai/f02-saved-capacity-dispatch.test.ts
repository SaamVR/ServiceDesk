import {describe,expect,it} from "vitest";
import {
  proposeSavedCapacityDispatch,type F02DispatchDependencies,
} from "../../src/server/ai/f02-saved-capacity-dispatch";

const workspaceId="workspace-1",branchId="branch-1",crewId="crew-1",
 visitId="visit-1",slotId="slot-1",asOf="2026-10-25T04:00:00Z";
const now=()=>Date.parse(asOf);
const visit={id:visitId,workspaceId,branchId,requestId:"request-1",quoteId:"quote-1",
  status:"CONFIRMED",version:3,serviceMinutes:60,bufferMinutes:15,
  startAt:"2026-10-25T10:00:00Z"};
const crew={id:crewId,branchId,active:true,name:"PRIVATE CREW NAME"};
const slot={id:slotId,branchId,crewId,startAt:"2026-10-25T09:00:00Z",
  endAt:"2026-10-25T12:00:00Z",capacityMinutes:150};
const snapshot=()=>({
  loadedAt:asOf,
  workspace:{id:workspaceId,slug:"qa-cleaning",name:"Demo",timezone:"UTC"},
  actor:{userId:"staff-1",workspaceId,role:"DISPATCHER"},
  branchScope:{mode:"BRANCH",selectedBranchId:branchId,
    branches:[{id:branchId,code:"B1",name:"demo",timezone:"UTC",currency:"USD",isDefault:true}]},
  visits:[visit],crews:[crew],capacitySlots:[slot],slotHolds:[],
});
function fixture(opts:{
  first?:(s:ReturnType<typeof snapshot>)=>void,
  second?:(s:ReturnType<typeof snapshot>)=>void,
  denied?:boolean,
}={}) {
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
 } as unknown as F02DispatchDependencies;
 return {deps,calls:()=>calls};
}
const run=(deps:F02DispatchDependencies)=>proposeSavedCapacityDispatch("qa-cleaning",deps);
describe("F02 saved-slot dispatch source and authority proof",()=>{
 it("uses a persisted available slot, but does not assert skills, send or assign",async()=>{
  const f=fixture(),r=await run(f.deps);
  expect(r).toMatchObject({ok:true,value:{
   state:"PERSISTED_CAPACITY_ADVISORY_STAFF_APPROVAL_REQUIRED",
   staffApprovalRequired:true,skillAvailabilityConfirmed:false,statusMutated:false,
   customerNotified:false,modelInvoked:false,
   proposals:[{visitId,visitVersion:3,availableSlotCandidates:[
    {crewId,capacitySlotId:slotId,crewSkillCheckRequired:true,assignmentPerformed:false},
   ]}],
  }});
  expect(f.calls()).toBe(2);
  expect(JSON.stringify(r)).not.toContain("PRIVATE CREW NAME");
 });
 it("exposes scheduling conflicts and live saved holds without inventing capacity",async()=>{
  const cases=[
   {first:(s:ReturnType<typeof snapshot>)=>{
     s.visits.push({...visit,id:"visit-2",crewId,
       startAt:"2026-10-25T10:30:00Z"} as typeof visit);
   },code:"SCHEDULE_OVERLAP"},
   {first:(s:ReturnType<typeof snapshot>)=>{
     s.slotHolds.push({id:"hold-1",slotId,quoteId:"quote-2",
       status:"HELD",expiresAt:"2026-10-25T06:00:00Z"} as never);
   },code:"SAVED_HOLD_CONFLICT"},
   {first:(s:ReturnType<typeof snapshot>)=>{s.capacitySlots[0].capacityMinutes=40;},
     code:"CAPACITY_INSUFFICIENT"},
   {first:(s:ReturnType<typeof snapshot>)=>{s.crews[0].active=false;},
     code:"CREW_NOT_ACTIVE"},
   {first:(s:ReturnType<typeof snapshot>)=>{s.capacitySlots=[];},
     code:"NO_CURRENT_SAVED_SLOT"},
  ];
  for(const item of cases){
   const f=fixture({first:item.first,second:item.first});
   const r=await run(f.deps);
   expect(r,JSON.stringify(item.code)).toMatchObject({ok:true,value:{proposals:[{
    availableSlotCandidates:[],reviewReasonCodes:expect.arrayContaining([item.code]),
    assignmentPerformed:false,
   }]}});
  }
 });
 it("rejects source that changes between staff-protected reads",async()=>{
  for(const mutate of [
   (s:ReturnType<typeof snapshot>)=>{s.visits[0].version=4;},
   (s:ReturnType<typeof snapshot>)=>{s.crews[0].active=false;},
   (s:ReturnType<typeof snapshot>)=>{s.capacitySlots[0].capacityMinutes=100;},
   (s:ReturnType<typeof snapshot>)=>{
    s.slotHolds.push({id:"hold-1",slotId,quoteId:"quote-2",
      status:"HELD",expiresAt:"2026-10-25T05:00:00Z"} as never);
   },
   (s:ReturnType<typeof snapshot>)=>{s.actor.userId="other-user";},
  ]) expect(await run(fixture({second:mutate}).deps))
      .toMatchObject({ok:false,code:expect.stringMatching(/F02_DISPATCH_/)});
 });
 it("fails closed on cross-branch source, stale clocks, invalid capacity and untrusted roles",async()=>{
  const variants=[
   (s:ReturnType<typeof snapshot>)=>{s.actor.role="CUSTOMER";},
   (s:ReturnType<typeof snapshot>)=>{s.crews[0].branchId="other-branch";},
   (s:ReturnType<typeof snapshot>)=>{s.capacitySlots[0].startAt="2026-02-30T08:00:00Z";},
   (s:ReturnType<typeof snapshot>)=>{s.capacitySlots[0].capacityMinutes=3000;},
   (s:ReturnType<typeof snapshot>)=>{s.visits[0].serviceMinutes=0;},
   (s:ReturnType<typeof snapshot>)=>{s.loadedAt="2026-10-24T00:00:00Z";},
   (s:ReturnType<typeof snapshot>)=>{s.capacitySlots.push({...slot});},
  ];
  for(const mutate of variants)expect((await run(fixture({first:mutate}).deps)).ok).toBe(false);
  expect(await run(fixture({denied:true}).deps))
   .toMatchObject({ok:false,code:"F02_DISPATCH_AUTH_REQUIRED"});
  expect((await proposeSavedCapacityDispatch("../foreign",fixture().deps)).ok).toBe(false);
 });
});
