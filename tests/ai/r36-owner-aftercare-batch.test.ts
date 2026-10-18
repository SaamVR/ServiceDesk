import {describe,expect,it} from "vitest";
import {buildOwnerAftercareBatch} from "../../src/server/ai/aftercare-batch-planner";
import type {VisitDTO} from "../../src/contracts";
const workspaceId="workspace-a",actor={workspaceId,role:"OWNER" as const};
const now="2026-10-18T03:00:00.000Z";
const mk=(i:number,opts:{optedOut?:boolean;quietHoursBlocked?:boolean;
  completed?:boolean;sourceEventId?:string;workspace?:string}={})=>{
  const visitId="visit-"+i;
  const visit:VisitDTO={id:visitId,workspaceId:opts.workspace??workspaceId,
    requestId:"request-"+i,quoteId:"quote-"+i,version:2,
    status:opts.completed===false?"PENDING_REVIEW":"COMPLETED",
    startAt:"2026-10-17T01:00:00.000Z",serviceMinutes:120,bufferMinutes:15};
  return {visit,completion:{workspaceId,visitId,visitVersion:2,
    eventId:opts.sourceEventId??"event-"+i,
    completedAt:"2026-10-17T02:00:00.000Z",
    source:"PERSISTED_VISIT_COMPLETION_JOURNAL" as const},
    recipient:{recipientRef:"recipient-"+i,
      consentRequired:true,hasOptIn:true,
      optedOut:Boolean(opts.optedOut),quietHoursBlocked:Boolean(opts.quietHoursBlocked)}};
};
const run=(entries:ReturnType<typeof mk>[])=>buildOwnerAftercareBatch({
  workspaceId,actor,now,entries,
});
describe("SONIC R36 L19 persisted source aftercare review batching",()=>{
 it("builds a review-only queue, counts suppressions and never infers provider delivery",()=>{
   const r=run([mk(1),mk(2,{optedOut:true}),mk(3,{quietHoursBlocked:true}),
     mk(4,{completed:false}),mk(5)]);
   expect(r).toMatchObject({ok:true,value:{
     inspectedCount:5,readyCount:2,
     suppressed:{OPTED_OUT:1,QUIET_HOURS:1,NOT_COMPLETED:1},
     state:"OWNER_AFTERCARE_REVIEW_QUEUE",anyProviderMessageSent:false,
     anyPaymentChanged:false,
   }});
   if(r.ok){
     expect(r.value.candidates.map(x=>x.visitId)).toEqual(["visit-1","visit-5"]);
     expect(r.value.candidates.every(x=>x.ownerApprovalRequired && !x.customerContactSent)).toBe(true);
     expect(JSON.stringify(r)).not.toContain("recipient-1");
   }
 });
 it("fails the entire batch if any saved event is untrustworthy, cross-tenant or repeated",()=>{
   for(const entries of [
     [mk(1),mk(1)],
     [mk(1),mk(2,{sourceEventId:"event-1"})],
     [mk(1),mk(2,{workspace:"other"})],
     [mk(1),{...mk(2),completion:{...mk(2).completion,source:"SYNTHETIC" as never}}],
   ])expect(run(entries)).toMatchObject({ok:false,code:"AFTERCARE_BATCH_SOURCE_INVALID"});
 });
 it("does not process 201 visits or allow non-owner batch orchestration",()=>{
   expect(run(Array.from({length:201},(_,i)=>mk(i))))
     .toMatchObject({ok:false,code:"AFTERCARE_BATCH_SOURCE_INVALID"});
   expect(buildOwnerAftercareBatch({workspaceId,actor:{workspaceId,role:"DISPATCHER"},
     now,entries:[mk(1)]}))
     .toMatchObject({ok:false,code:"AFTERCARE_BATCH_SCOPE_INVALID"});
 });
});
