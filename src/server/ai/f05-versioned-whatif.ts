import {prepareF05VersionedInstructionDraft,
 type F05InstructionRequest,type F05InstructionDeps,type F05SourceEvidence}
 from "./f05-versioned-instruction-draft";
import {previewOwnerWorkflowWhatIf} from "./workflow-what-if-preview";

export interface F05VersionedWhatIfInput extends F05InstructionRequest {
 expectedEvidence:F05SourceEvidence;
 sampleServiceCode:"NONE"|"STANDARD"|"DEEP"|"MOVE_OUT";
}
export type F05VersionedWhatIfResult=
 | {ok:false;code:"F05_WHATIF_INPUT_INVALID"|"F05_WHATIF_SOURCE_UNAVAILABLE"|
   "F05_WHATIF_SOURCE_STALE"|"F05_WHATIF_ENGINE_REFUSED"|"F05_WHATIF_CANCELLED"}
 | {ok:true;value:{
   state:"VERSIONED_SAVED_DRAFT_HYPOTHETICAL_ONLY";
   source:"REAUTHORIZED_SAVED_VERSION_AND_PRODUCTION_PREVIEW_ENGINE";
   workspaceId:string;branchId:string;
   ruleId:string|null;sourceDigest:string;basedOnPublishedVersion:number|null;
   sampleServiceCode:"NONE"|"STANDARD"|"DEEP"|"MOVE_OUT";
   eventType:string;matched:boolean;wouldCreateAttention:boolean;
   checkedConditions:Array<{field:string;matched:boolean}>;
   noSavedEventSupplied:true;revalidateBeforeSave:true;
   published:false;executed:false;customerMessagesSent:false;
   financialStateChanged:false;modelInvoked:false;
 }};
const fail=(code:Extract<F05VersionedWhatIfResult,{ok:false}>["code"]):F05VersionedWhatIfResult=>({ok:false,code});
function exactEvidence(x:unknown):x is F05SourceEvidence{
 try{
  if(!x||typeof x!=="object"||Array.isArray(x)||
     Object.getPrototypeOf(x)!==Object.prototype)return false;
  const keys=Object.keys(x);
  if(Reflect.ownKeys(x).length!==keys.length||
     Object.values(Object.getOwnPropertyDescriptors(x)).some(d=>!Object.hasOwn(d,"value"))||
     keys.length!==7||
     !["branchId","ruleId","ruleRevision","basedOnPublishedVersion","nextReviewVersion",
       "sourceDigest","inventoryCompletenessUnverified"].every(k=>Object.hasOwn(x,k)))
      return false;
  const e=x as F05SourceEvidence;
  const validNumber=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>=1;
  return typeof e.branchId==="string"&&e.branchId.length>0&&
   (e.ruleId===null||typeof e.ruleId==="string")&&
   (e.ruleRevision===null||validNumber(e.ruleRevision))&&
   (e.basedOnPublishedVersion===null||validNumber(e.basedOnPublishedVersion))&&
   validNumber(e.nextReviewVersion)&&
   typeof e.sourceDigest==="string"&&/^[0-9a-f]{64}$/.test(e.sourceDigest)&&
   e.inventoryCompletenessUnverified===true;
 }catch{return false;}
}
/** A synthetic what-if for a version that was ALREADY shown to an owner.
 * Re-reads the saved version through the source-only authoring proof before
 * dispatching to the shipped PREVIEW engine. The supplied evidence is a
 * precondition, never a replacement for authenticated persisted evidence.
 */
export async function previewF05VersionedWhatIf(
 input:F05VersionedWhatIfInput,deps:F05InstructionDeps={},
):Promise<F05VersionedWhatIfResult>{
 if(!input||typeof input!=="object"||Array.isArray(input)||
    Object.getPrototypeOf(input)!==Object.prototype||
    Reflect.ownKeys(input).length!==Object.keys(input).length||
    Object.values(Object.getOwnPropertyDescriptors(input)).some(d=>!Object.hasOwn(d,"value"))||
    Object.keys(input).some(k=>!["workspaceSlug","branchId","instruction","ruleId",
      "expectedSavedRuleVersion","expectedEvidence","sampleServiceCode"].includes(k))||
    !exactEvidence(input.expectedEvidence)||
    !["NONE","STANDARD","DEEP","MOVE_OUT"].includes(input.sampleServiceCode))
      return fail("F05_WHATIF_INPUT_INVALID");
 if(deps.signal?.aborted)return fail("F05_WHATIF_CANCELLED");
 const authored=await prepareF05VersionedInstructionDraft({
    workspaceSlug:input.workspaceSlug,branchId:input.branchId,
    instruction:input.instruction,
    ...(input.ruleId===undefined?{}:{ruleId:input.ruleId}),
    ...(input.expectedSavedRuleVersion===undefined?{}:
       {expectedSavedRuleVersion:input.expectedSavedRuleVersion}),
 },deps);
 if(!authored.ok)return fail(deps.signal?.aborted?"F05_WHATIF_CANCELLED":"F05_WHATIF_SOURCE_UNAVAILABLE");
 const review=authored.value;
 // Never trust just a caller-supplied digest; the entire saved revision,
 // ID, source branch and exact next review version must agree.
 if(JSON.stringify(review.evidence)!==JSON.stringify(input.expectedEvidence))
   return fail("F05_WHATIF_SOURCE_STALE");
 if(deps.signal?.aborted)return fail("F05_WHATIF_CANCELLED");
 const severity=review.draft.actions[0]?.severity;
 const field=review.draft.conditions[0];
 if(!severity||!["INFO","WARNING","CRITICAL"].includes(severity)||
    review.draft.actions.length!==1||
    review.draft.actions[0].type!=="CREATE_ATTENTION"||
    review.draft.conditions.length>1||
    (field&&(field.field!=="request.serviceCode"||
      field.operator!=="EQ"||!["STANDARD","DEEP","MOVE_OUT"].includes(String(field.value)))))
    return fail("F05_WHATIF_ENGINE_REFUSED");
 const candidate={
   eventType:review.draft.eventType,
   severity,
   ...(field?{serviceCode:field.value as "STANDARD"|"DEEP"|"MOVE_OUT"}:{}),
 };
 const sample=input.sampleServiceCode==="NONE"?{}:
   {serviceCode:input.sampleServiceCode};
 const output=previewOwnerWorkflowWhatIf(candidate,{
   workspaceId:review.workspaceId,actorWorkspaceId:review.workspaceId,
   branchId:review.branchId,role:"OWNER",
 },sample);
 if(!output.ok)return fail("F05_WHATIF_ENGINE_REFUSED");
 if(deps.signal?.aborted)return fail("F05_WHATIF_CANCELLED");
 return {ok:true,value:{
   state:"VERSIONED_SAVED_DRAFT_HYPOTHETICAL_ONLY",
   source:"REAUTHORIZED_SAVED_VERSION_AND_PRODUCTION_PREVIEW_ENGINE",
   workspaceId:review.workspaceId,branchId:review.branchId,
   ruleId:review.evidence.ruleId,sourceDigest:review.evidence.sourceDigest,
   basedOnPublishedVersion:review.evidence.basedOnPublishedVersion,
   sampleServiceCode:input.sampleServiceCode,
   eventType:output.value.eventType,
   matched:output.value.matched,wouldCreateAttention:output.value.wouldCreateAttention,
   checkedConditions:output.value.checkedConditions.map(c=>({
     field:c.field,matched:c.matched,
   })),
   noSavedEventSupplied:true,revalidateBeforeSave:true,
   published:false,executed:false,customerMessagesSent:false,
   financialStateChanged:false,modelInvoked:false,
 }};
}
