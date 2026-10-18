import {planConsentAwareAftercare,type AftercareReviewInput} from "./aftercare-review";

export interface AftercareBatchInput {
  workspaceId:string;
  actor:AftercareReviewInput["actor"];
  now:string;
  entries:readonly Pick<AftercareReviewInput,"visit"|"completion"|"recipient">[];
}
export type AftercareSuppressionReason =
  "CONSENT_REQUIRED"|"OPTED_OUT"|"QUIET_HOURS"|"NOT_COMPLETED"|"TOO_OLD";
export type AftercareBatchResult =
  | {ok:false;code:"AFTERCARE_BATCH_SCOPE_INVALID"|"AFTERCARE_BATCH_SOURCE_INVALID"}
  | {ok:true;value:{
    state:"OWNER_AFTERCARE_REVIEW_QUEUE";
    source:"PERSISTED_COMPLETION_AND_CONSENT_INPUTS_ONLY";
    workspaceId:string;
    inspectedCount:number;readyCount:number;
    candidates:Array<{visitId:string;sourceEventId:string;visitVersion:number;
      completedAt:string;ownerApprovalRequired:true;customerContactSent:false;}>;
    suppressed:Record<AftercareSuppressionReason,number>;
    anyProviderMessageSent:false;anyPaymentChanged:false;
  }};

const safeId=(v:unknown)=>typeof v==="string"&&/^[A-Za-z0-9:_-]{3,128}$/.test(v);
/** No generic reminder blast: pre-verified completion journals and live
 * recipient policies are supplied by a tenant-authorized service read. This
 * produces internal owner review proposals only, not an outbox dispatch. */
export function buildOwnerAftercareBatch(input:AftercareBatchInput):AftercareBatchResult {
  if(!input || !safeId(input.workspaceId) ||
     !input.actor || input.actor.role!=="OWNER" ||
     input.actor.workspaceId!==input.workspaceId)
     return {ok:false,code:"AFTERCARE_BATCH_SCOPE_INVALID"};
  if(!Array.isArray(input.entries) || input.entries.length>200 ||
     typeof input.now!=="string")
     return {ok:false,code:"AFTERCARE_BATCH_SOURCE_INVALID"};

  const visits=new Set<string>(),events=new Set<string>();
  const suppressed:Record<AftercareSuppressionReason,number>={
    CONSENT_REQUIRED:0,OPTED_OUT:0,QUIET_HOURS:0,
    NOT_COMPLETED:0,TOO_OLD:0,
  };
  const candidates:Extract<AftercareBatchResult,{ok:true}>["value"]["candidates"]=[];
  for(const entry of input.entries){
    if(!entry || !entry.visit || !entry.completion ||
       !safeId(entry.visit.id) || !safeId(entry.completion.eventId) ||
       visits.has(entry.visit.id) || events.has(entry.completion.eventId))
       return {ok:false,code:"AFTERCARE_BATCH_SOURCE_INVALID"};
    visits.add(entry.visit.id);
    events.add(entry.completion.eventId);
    const item=planConsentAwareAftercare({
      actor:input.actor,workspaceId:input.workspaceId,
      now:input.now,visit:entry.visit,
      completion:entry.completion,recipient:entry.recipient,
    });
    if(!item.ok)return {ok:false,code:"AFTERCARE_BATCH_SOURCE_INVALID"};
    if(item.value.eligibleForManualReview){
      candidates.push({
        visitId:entry.visit.id,sourceEventId:entry.completion.eventId,
        visitVersion:entry.visit.version,
        completedAt:entry.completion.completedAt,
        ownerApprovalRequired:true,customerContactSent:false,
      });
    }else{
      suppressed[item.value.reason as AftercareSuppressionReason]++;
    }
  }
  // Oldest saved eligible visit is first; a source event ID is a stable tie
  // break. No due date is invented, and quiet hours suppress rather than
  // scheduling a future send without explicit business permissions.
  candidates.sort((a,b)=>a.completedAt.localeCompare(b.completedAt) ||
    a.sourceEventId.localeCompare(b.sourceEventId));
  return {ok:true,value:{
    state:"OWNER_AFTERCARE_REVIEW_QUEUE",
    source:"PERSISTED_COMPLETION_AND_CONSENT_INPUTS_ONLY",
    workspaceId:input.workspaceId,inspectedCount:input.entries.length,
    readyCount:candidates.length,candidates,suppressed,
    anyProviderMessageSent:false,anyPaymentChanged:false,
  }};
}
