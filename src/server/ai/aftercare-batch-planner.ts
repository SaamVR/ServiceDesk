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
    reviewSuggested:boolean;oldestReadyAt?:string;
    candidates:Array<{visitId:string;sourceEventId:string;visitVersion:number;
      completedAt:string;ownerApprovalRequired:true;customerContactSent:false;}>;
    suppressed:Record<AftercareSuppressionReason,number>;
    anyProviderMessageSent:false;anyPaymentChanged:false;
  }};

const safeId=(v:unknown)=>typeof v==="string"&&/^[A-Za-z0-9:_-]{3,128}$/.test(v);
const exactUtc=(v:unknown):v is string=>
  typeof v==="string" &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v) &&
  Number.isFinite(Date.parse(v)) &&
  new Date(Date.parse(v)).toISOString()===v;
function denseDataArray(value:unknown,max:number):value is unknown[]{
  if(!Array.isArray(value)||value.length>max ||
     Reflect.ownKeys(value).length!==value.length+1)return false;
  for(let i=0;i<value.length;i++){
    const d=Object.getOwnPropertyDescriptor(value,String(i));
    if(!d||!Object.hasOwn(d,"value"))return false;
  }
  return true;
}

/** No generic reminder blast: pre-verified completion journals and live
 * recipient policies are supplied by a tenant-authorized service read. This
 * produces internal owner review proposals only, not an outbox dispatch. */
export function buildOwnerAftercareBatch(input:AftercareBatchInput):AftercareBatchResult {
  if(!input || !safeId(input.workspaceId) ||
     !input.actor || input.actor.role!=="OWNER" ||
     input.actor.workspaceId!==input.workspaceId)
     return {ok:false,code:"AFTERCARE_BATCH_SCOPE_INVALID"};
  if(!denseDataArray(input.entries,200) || !exactUtc(input.now))
     return {ok:false,code:"AFTERCARE_BATCH_SOURCE_INVALID"};

  const visits=new Set<string>(),events=new Set<string>();
  const suppressed:Record<AftercareSuppressionReason,number>={
    CONSENT_REQUIRED:0,OPTED_OUT:0,QUIET_HOURS:0,
    NOT_COMPLETED:0,TOO_OLD:0,
  };
  const candidates:Extract<AftercareBatchResult,{ok:true}>["value"]["candidates"]=[];
  for(const entry of input.entries){
    // Only the expected saved-source triple may authorize a follow-up
    // review. Hidden or unexpected model/provider action keys are vetoes.
    if(!entry || typeof entry!=="object" || Array.isArray(entry) ||
       Object.getPrototypeOf(entry)!==Object.prototype ||
       Object.keys(entry).length!==3 || Reflect.ownKeys(entry).length!==3 ||
       !["visit","completion","recipient"].every(key=>Object.hasOwn(entry,key)) ||
       Object.values(Object.getOwnPropertyDescriptors(entry)).some(d=>!Object.hasOwn(d,"value")) ||
       !entry.visit || !entry.completion ||
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
    reviewSuggested:candidates.length>0,
    ...(candidates.length>0?{oldestReadyAt:candidates[0].completedAt}:{}),
    anyProviderMessageSent:false,anyPaymentChanged:false,
  }};
}
