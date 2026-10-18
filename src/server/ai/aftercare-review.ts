import type {VisitDTO} from "../../contracts";
import type {RecipientPolicy} from "../integrations/types";

export interface CommittedVisitCompletionEvidence {
  workspaceId:string;visitId:string;visitVersion:number;
  eventId:string;completedAt:string;
  source:"PERSISTED_VISIT_COMPLETION_JOURNAL";
}
export interface AftercareReviewInput {
  workspaceId:string;
  actor:{workspaceId:string;role:"OWNER"|"DISPATCHER"|"CREW"|"CUSTOMER"};
  visit:VisitDTO;
  completion:CommittedVisitCompletionEvidence;
  recipient:RecipientPolicy;
  now:string;
}
export type AftercareReviewResult =
  | {ok:false;code:"AFTERCARE_OWNER_REQUIRED"|"AFTERCARE_SOURCE_INVALID"}
  | {ok:true;value:{
    state:"AFTERCARE_OWNER_APPROVAL_REQUIRED";
    source:"SERVER_SUPPLIED_COMMITTED_COMPLETION_EVIDENCE";
    workspaceId:string;visitId:string;sourceEventId:string;
    eligibleForManualReview:boolean;
    reason:"CONSENT_REQUIRED"|"OPTED_OUT"|"QUIET_HOURS"|"NOT_COMPLETED"|
      "TOO_OLD"|"READY_TO_REVIEW";
    customerContactSent:false;
    providerDeliveryVerified:false;
    draftOnly:true;automatedSend:false;
  }};
const id=(v:unknown)=>typeof v==="string" &&
  /^[A-Za-z0-9:_-]{3,128}$/.test(v);
function exactUtc(s:unknown):s is string {
  if(typeof s!=="string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(s))return false;
  const at=Date.parse(s);
  return Number.isFinite(at)&&new Date(at).toISOString()===s;
}
/** A queued event and active consent do NOT authorize automatic contact.
 * This only flags an owner-approved aftercare candidate, with no provider
 * side effects, copied customer content or invented delivery receipt. */
export function planConsentAwareAftercare(input:AftercareReviewInput):AftercareReviewResult {
  const {workspaceId,actor,visit,completion,recipient,now}=input??{};
  if(!actor || actor.role!=="OWNER" || actor.workspaceId!==workspaceId || !id(workspaceId))
    return {ok:false,code:"AFTERCARE_OWNER_REQUIRED"};
  if(!visit || visit.workspaceId!==workspaceId || !id(visit.id) ||
     !Number.isSafeInteger(visit.version) || visit.version<1 ||
     !completion || completion.workspaceId!==workspaceId ||
     completion.visitId!==visit.id || completion.visitVersion!==visit.version ||
     completion.source!=="PERSISTED_VISIT_COMPLETION_JOURNAL" ||
     !id(completion.eventId) || !exactUtc(completion.completedAt) ||
     !exactUtc(now) || Date.parse(completion.completedAt)>Date.parse(now) ||
     !recipient || typeof recipient.recipientRef!=="string" ||
     recipient.recipientRef.length<3 || recipient.recipientRef.length>128 ||
     typeof recipient.hasOptIn!=="boolean" || typeof recipient.optedOut!=="boolean" ||
     typeof recipient.consentRequired!=="boolean" ||
     (recipient.quietHoursBlocked!==undefined &&
      typeof recipient.quietHoursBlocked!=="boolean"))
    return {ok:false,code:"AFTERCARE_SOURCE_INVALID"};
  let reason:Extract<AftercareReviewResult,{ok:true}>["value"]["reason"]="READY_TO_REVIEW";
  if(visit.status!=="COMPLETED")reason="NOT_COMPLETED";
  else if(Date.parse(now)-Date.parse(completion.completedAt)>60*86400_000)reason="TOO_OLD";
  else if(recipient.optedOut)reason="OPTED_OUT";
  else if(recipient.consentRequired && !recipient.hasOptIn)reason="CONSENT_REQUIRED";
  else if(recipient.quietHoursBlocked)reason="QUIET_HOURS";
  return {ok:true,value:{
    state:"AFTERCARE_OWNER_APPROVAL_REQUIRED",
    source:"SERVER_SUPPLIED_COMMITTED_COMPLETION_EVIDENCE",
    workspaceId,visitId:visit.id,sourceEventId:completion.eventId,
    eligibleForManualReview:reason==="READY_TO_REVIEW",reason,
    customerContactSent:false,providerDeliveryVerified:false,
    draftOnly:true,automatedSend:false,
  }};
}
