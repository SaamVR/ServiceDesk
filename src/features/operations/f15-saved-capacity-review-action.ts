"use server";
import { proposeSavedCapacityDispatch } from "@/server/ai/f02-saved-capacity-dispatch";
type Reason="CREW_NOT_ACTIVE"|"NO_CURRENT_SAVED_SLOT"|"SLOT_AMBIGUITY"|"CAPACITY_INSUFFICIENT"|"SCHEDULE_OVERLAP"|"SAVED_HOLD_CONFLICT";
const reasons=new Set<Reason>(["CREW_NOT_ACTIVE","NO_CURRENT_SAVED_SLOT","SLOT_AMBIGUITY",
 "CAPACITY_INSUFFICIENT","SCHEDULE_OVERLAP","SAVED_HOLD_CONFLICT"]);
export type F15DispatchReview=
 | {ok:false;state:"CAPACITY_REVIEW_UNAVAILABLE"}
 | {ok:true;state:"SAVED_CAPACITY_REVIEW_ONLY";sourceClock:string;
     visitsNeedingAssignment:number;availableSlotCandidates:number; blockedVisits:number;
     reasons:Reason[];skillsUnverified:true;staffApprovalRequired:true;
     assigned:false;modelInvoked:false;messagesSent:false};
const unavailable=():F15DispatchReview=>({ok:false,state:"CAPACITY_REVIEW_UNAVAILABLE"});
/** F02 double-reads authorized capacity, crew availability and held slots.
 * This action intentionally exports only aggregate counts and safe reason codes:
 * no crew/customer/visit identifiers cross to the browser. */
export async function requestF15SavedCapacityReview(workspaceSlug:string):Promise<F15DispatchReview>{
 if(typeof workspaceSlug!=="string"||workspaceSlug.length<3||workspaceSlug.length>40||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(workspaceSlug))return unavailable();
 try{
  const r=await proposeSavedCapacityDispatch(workspaceSlug);
  if(!r.ok)return unavailable();
  const v=r.value;
  if(v.state!=="PERSISTED_CAPACITY_ADVISORY_STAFF_APPROVAL_REQUIRED"||
     v.source!=="DOUBLE_READ_AUTHORIZED_OPERATIONAL_SNAPSHOT"||
     !Array.isArray(v.proposals)||v.proposals.length>299||
     v.staffApprovalRequired!==true||v.skillAvailabilityConfirmed!==false||
     v.statusMutated!==false||v.customerNotified!==false||v.modelInvoked!==false||
     !Number.isFinite(Date.parse(v.sourceClock)))return unavailable();
  let slots=0,blocked=0;
  const seen=new Set<Reason>();
  for(const p of v.proposals){
   if(!Array.isArray(p.availableSlotCandidates)||p.availableSlotCandidates.length>99||
      !Array.isArray(p.reviewReasonCodes)||p.reviewReasonCodes.length>6||
      p.assignmentPerformed!==false)return unavailable();
   slots+=p.availableSlotCandidates.length;
   if(p.availableSlotCandidates.length===0)blocked++;
   for(const code of p.reviewReasonCodes){
    if(!reasons.has(code as Reason))return unavailable();
    seen.add(code as Reason);
   }
  }
  return {ok:true,state:"SAVED_CAPACITY_REVIEW_ONLY",
   sourceClock:v.sourceClock,visitsNeedingAssignment:v.proposals.length,
   availableSlotCandidates:slots,blockedVisits:blocked,reasons:[...seen].sort(),
   skillsUnverified:true,staffApprovalRequired:true,assigned:false,
   modelInvoked:false,messagesSent:false};
 }catch{return unavailable();}
}
