import {describe,expect,it} from "vitest";
import {buildOwnerAftercareBatch} from "../../src/server/ai/aftercare-batch-planner";
import type {VisitDTO} from "../../src/contracts";
const workspaceId="workspace-a",now="2026-10-18T03:00:00.000Z";
const actor={workspaceId,role:"OWNER" as const};
const record=(i:number)=>{
 const visitId="visit-"+i;
 const visit:VisitDTO={id:visitId,workspaceId,requestId:"request-"+i,
  quoteId:"quote-"+i,version:1,status:"COMPLETED",
  startAt:"2026-10-17T01:00:00.000Z",serviceMinutes:60,bufferMinutes:10};
 return {visit,completion:{workspaceId,visitId,visitVersion:1,eventId:"event-"+i,
  completedAt:"2026-10-17T02:00:00.000Z",
  source:"PERSISTED_VISIT_COMPLETION_JOURNAL" as const},
  recipient:{recipientRef:"recipient-"+i,consentRequired:true,
   hasOptIn:true,optedOut:false,quietHoursBlocked:false}};
};
const plan=(count:number)=>buildOwnerAftercareBatch({
 workspaceId,actor,now,entries:Array.from({length:count},(_,i)=>record(i))
});
describe("SONIC R39 L19 aftercare capped-owner-review completeness",()=>{
 it("rejects a fully saturated source page rather than claiming complete processing",()=>{
   expect(plan(200)).toMatchObject({ok:false,code:"AFTERCARE_BATCH_SOURCE_INVALID"});
   expect(plan(201)).toMatchObject({ok:false,code:"AFTERCARE_BATCH_SOURCE_INVALID"});
 });
 it("preserves review-only candidates for below-cap explicit saved source sets",()=>{
   const r=plan(2);
   expect(r).toMatchObject({ok:true,value:{
     state:"OWNER_AFTERCARE_REVIEW_QUEUE",inspectedCount:2,readyCount:2,
     reviewSuggested:true,anyProviderMessageSent:false,anyPaymentChanged:false,
   }});
   if(!r.ok)throw Error("expected valid review plan");
   expect(r.value.candidates.every(x=>x.ownerApprovalRequired && !x.customerContactSent)).toBe(true);
   expect(JSON.stringify(r)).not.toContain("recipient-0");
 });
 it("never treats malformed/holey/bypassed source pagination as review-complete",()=>{
   const holes=new Array(4);
   const extra=[record(1)] as typeof holes;
   Object.defineProperty(extra,"secret",{value:"private",enumerable:false});
   for(const entries of [holes,extra]){
      expect(buildOwnerAftercareBatch({workspaceId,actor,now,entries}))
        .toMatchObject({ok:false,code:"AFTERCARE_BATCH_SOURCE_INVALID"});
   }
 });
});
