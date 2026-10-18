import {buildDispatchRecommendations,type DispatchSnapshot} from "../../features/dispatch/recommendations";
import {trustedQuoteInstant} from "../../features/operations/quote-validity-clock";

export interface DispatchAiReviewInput {
  actor:{workspaceId:string;role:"OWNER"|"DISPATCHER"|"CREW"|"CUSTOMER"};
  workspaceId:string;
  /** These rows must come from a tenant-authorized, COMPLETE server snapshot. */
  snapshot:DispatchSnapshot;
}
export type DispatchAiReviewResult =
  | {ok:false;code:"DISPATCH_REVIEW_ROLE_REQUIRED"|"DISPATCH_REVIEW_SOURCE_UNVERIFIED"}
  | {ok:true;value:{
      state:"SAVED_DISPATCH_ADVISORY_HUMAN_APPROVAL_REQUIRED";
      source:"AUTHORITY_DEPENDS_ON_CALLER_SAVED_SCOPE";
      workspaceId:string;
      unassignedVisits:number;
      withVerifiedFit:number;
      needingManualReview:number;
      proposals:Array<{
        visitId:string;visitVersion:number;
        eligibleCrewCount:number;
        verifiedCrewId?:string;
        confidence:"HIGH"|"NONE";
        blockedReasonCodes:string[];
        ownerOrDispatcherApprovalRequired:true;
        availabilityConfirmed:false;
        crewAssigned:false;
        customerNotified:false;
        routeEfficiency:"NOT_SCORED_NO_GEOGRAPHY";
      }>;
      modelInvoked:false;
      businessStateMutated:false;
    }};

const safeId=(v:unknown):v is string=>
  typeof v==="string" && /^[A-Za-z0-9:_-]{3,128}$/.test(v);
const validClock=(v:unknown)=>trustedQuoteInstant(v)!==null;
const allowedStatus=new Set([
 "AWAITING_PAYMENT","CONFIRMED","ASSIGNED","EN_ROUTE","IN_PROGRESS",
 "PENDING_REVIEW","COMPLETED","CANCELLED","PAYMENT_REVIEW",
]);
/**
 * Deterministic fallback for AI-assisted dispatch: do not turn a partial
 * skills/calendar match into a "confirmed" booking. Routes are NOT scored.
 * An authorized caller must re-check visit version, crew capacity and
 * business permissions before issuing an actual assignment.
 */
export function prepareDispatchAiReview(input:DispatchAiReviewInput):DispatchAiReviewResult {
 if(!input || !input.actor ||
    (input.actor.role!=="OWNER" && input.actor.role!=="DISPATCHER") ||
    !safeId(input.workspaceId) ||
    input.actor.workspaceId!==input.workspaceId)
    return {ok:false,code:"DISPATCH_REVIEW_ROLE_REQUIRED"};
 const data=input.snapshot;
 if(!data || !Array.isArray(data.visits) || data.visits.length>=150 ||
    !Array.isArray(data.crews) || data.crews.length>=80 ||
    Reflect.ownKeys(data.visits).length!==data.visits.length+1 ||
    Reflect.ownKeys(data.crews).length!==data.crews.length+1)
    return {ok:false,code:"DISPATCH_REVIEW_SOURCE_UNVERIFIED"};
 const visitIds=new Set<string>(),crewIds=new Set<string>();
 for(const visit of data.visits) {
   if(!visit || visit.workspaceId!==input.workspaceId || !safeId(visit.id) ||
      visitIds.has(visit.id) ||
      !allowedStatus.has(visit.status) ||
      !Number.isSafeInteger(visit.version) || visit.version<1 ||
      !Number.isSafeInteger(visit.serviceMinutes) || visit.serviceMinutes<1 ||
      !Number.isSafeInteger(visit.bufferMinutes) || visit.bufferMinutes<0 ||
      visit.serviceMinutes+visit.bufferMinutes>1440 ||
      !validClock(visit.startAt) ||
      (visit.crewId!==undefined && !safeId(visit.crewId)))
      return {ok:false,code:"DISPATCH_REVIEW_SOURCE_UNVERIFIED"};
   visitIds.add(visit.id);
 }
 for(const crew of data.crews) {
   if(!crew || crew.workspaceId!==input.workspaceId || !safeId(crew.id) ||
      crewIds.has(crew.id) || typeof crew.active!=="boolean" ||
      (crew.serviceCodes!==undefined &&
        (!Array.isArray(crew.serviceCodes) ||
         crew.serviceCodes.length>20 ||
         crew.serviceCodes.some(code=>typeof code!=="string" || !/^[A-Z0-9_-]{1,64}$/.test(code)))) ||
      (crew.availableFrom!==undefined && !validClock(crew.availableFrom)) ||
      (crew.availableTo!==undefined && !validClock(crew.availableTo)) ||
      (crew.availableFrom!==undefined && crew.availableTo!==undefined &&
       trustedQuoteInstant(crew.availableFrom)!>trustedQuoteInstant(crew.availableTo)!))
      return {ok:false,code:"DISPATCH_REVIEW_SOURCE_UNVERIFIED"};
   crewIds.add(crew.id);
 }
 if(data.visits.some(v=>v.crewId!==undefined&&!crewIds.has(v.crewId)))
   return {ok:false,code:"DISPATCH_REVIEW_SOURCE_UNVERIFIED"};
 const recommendations=buildDispatchRecommendations(data);
 const proposals=recommendations.map(r=>{
   const high=r.candidates.filter(c=>c.eligible && c.confidence==="HIGH");
   const first=high[0];
   const conflicts=[...new Set(r.candidates.flatMap(c=>c.conflicts))].sort();
   return {
     visitId:r.visitId,visitVersion:r.visitVersion,
     eligibleCrewCount:high.length,
     ...(first?{verifiedCrewId:first.candidateCrewId}:{}),
     confidence:first?"HIGH" as const:"NONE" as const,
     blockedReasonCodes:conflicts,
     ownerOrDispatcherApprovalRequired:true as const,
     availabilityConfirmed:false as const,
     crewAssigned:false as const,customerNotified:false as const,
     routeEfficiency:"NOT_SCORED_NO_GEOGRAPHY" as const,
   };
 });
 const withVerifiedFit=proposals.filter(p=>p.confidence==="HIGH").length;
 return {ok:true,value:{
   state:"SAVED_DISPATCH_ADVISORY_HUMAN_APPROVAL_REQUIRED",
   source:"AUTHORITY_DEPENDS_ON_CALLER_SAVED_SCOPE",
   workspaceId:input.workspaceId,unassignedVisits:proposals.length,
   withVerifiedFit,needingManualReview:proposals.length-withVerifiedFit,
   proposals,modelInvoked:false,businessStateMutated:false,
 }};
}
