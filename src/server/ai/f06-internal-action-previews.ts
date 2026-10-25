import {createHash} from "node:crypto";
import {trustedQuoteInstant} from "@/features/operations/quote-validity-clock";
import {proposeF06TypedEvent} from "./f06-typed-event-proposals";

/** These action strings are not shipped WorkflowActionType. Pure unpersisted
 * review projections; never pass them to the SQL workflow executor.
 */
export type F06InternalActionKind=
 "CREATE_TASK"|"REQUEST_OWNER_APPROVAL"|"SCHEDULE_REMINDER"|"EMIT_OWNER_DIGEST";
export type F06InternalActionIntent=
 | {kind:"CREATE_TASK";taskCode:"REVIEW_SOURCE_EVENT"|"INVESTIGATE_EXCEPTION"}
 | {kind:"REQUEST_OWNER_APPROVAL";approvalCode:"SOURCE_RECONCILIATION"|"OPERATIONS_EXCEPTION"}
 | {kind:"SCHEDULE_REMINDER";remindAt:string;purpose:"INTERNAL_OWNER_REVIEW"}
 | {kind:"EMIT_OWNER_DIGEST";digestCode:"OWNER_EVENT_REVIEW"|"OPERATIONS_EXCEPTION_SUMMARY"};
export type F06ActionReviewInput={
 eventInput:unknown;intent:F06InternalActionIntent;
 expectedEventFingerprint:string;
};
export type F06ActionReviewResult=
 | {ok:false;code:"F06_ACTION_INPUT_INVALID"|"F06_ACTION_EVENT_UNVERIFIED"|
   "F06_ACTION_FINGERPRINT_STALE"|"F06_ACTION_REMINDER_INVALID"}
 | {ok:true;value:{
   state:"F06_UNPERSISTED_INTERNAL_ACTION_PREVIEW_ONLY";
   kind:F06InternalActionKind;
   workspaceId:string;branchId:string;
   sourceId:string;sourceVersion:number;
   eventType:string;eventProposalFingerprint:string;
   actionPreviewFingerprint:string;
   taskCode?:string;approvalCode?:string;
   remindAt?:string;reminderPurpose?:"INTERNAL_OWNER_REVIEW";
   digestCode?:string;
   executionIdempotencyUnproven:true;
   serverAuthorityRequired:true;
   executionWriterUnavailable:true;
   businessTimeZoneUnverified:true;
   ownerApprovalRequired:true;scheduled:false;persisted:false;
   executed:false;published:false;providerCalled:false;
   customerMessageSent:false;financialStateMutated:false;
 }};
const fail=(code:Extract<F06ActionReviewResult,{ok:false}>["code"]):F06ActionReviewResult=>({ok:false,code});
function exact(v:unknown,keys:readonly string[]):v is Record<string,unknown>{
 try{
  if(!v||typeof v!=="object"||Array.isArray(v)||
     Object.getPrototypeOf(v)!==Object.prototype)return false;
  const own=Reflect.ownKeys(v);
  if(own.length!==keys.length||own.some(k=>typeof k!=="string"||!keys.includes(k))||
     !keys.every(k=>Object.hasOwn(v,k)))return false;
  return Object.values(Object.getOwnPropertyDescriptors(v))
     .every(d=>Object.hasOwn(d,"value"));
 }catch{return false;}
}
/** No task queue, approval creation, real scheduled timer or digest transport.
 * Existing event proposal must be revalidated from original strict input,
 * and prior owner-facing fingerprint must match recomputed candidate.
 */
export function previewF06InternalAction(input:unknown):F06ActionReviewResult{
 if(!exact(input,["eventInput","intent","expectedEventFingerprint"])||
    typeof input.expectedEventFingerprint!=="string"||
    !/^[a-f0-9]{64}$/.test(input.expectedEventFingerprint)||
    !input.intent||typeof input.intent!=="object"||Array.isArray(input.intent))
   return fail("F06_ACTION_INPUT_INVALID");
 const intent=input.intent as Record<string,unknown>;
 let actionData:string|null=null;
 let kind:F06InternalActionKind;
 if(intent.kind==="CREATE_TASK"){
  if(!exact(intent,["kind","taskCode"])||
      !["REVIEW_SOURCE_EVENT","INVESTIGATE_EXCEPTION"].includes(String(intent.taskCode)))
    return fail("F06_ACTION_INPUT_INVALID");
  kind="CREATE_TASK";actionData=intent.taskCode as string;
 }else if(intent.kind==="REQUEST_OWNER_APPROVAL"){
  if(!exact(intent,["kind","approvalCode"])||
      !["SOURCE_RECONCILIATION","OPERATIONS_EXCEPTION"].includes(String(intent.approvalCode)))
    return fail("F06_ACTION_INPUT_INVALID");
  kind="REQUEST_OWNER_APPROVAL";actionData=intent.approvalCode as string;
 }else if(intent.kind==="SCHEDULE_REMINDER"){
  if(!exact(intent,["kind","remindAt","purpose"])||
     intent.purpose!=="INTERNAL_OWNER_REVIEW")
    return fail("F06_ACTION_INPUT_INVALID");
  kind="SCHEDULE_REMINDER";
  actionData=intent.remindAt as string;
 }else if(intent.kind==="EMIT_OWNER_DIGEST"){
  if(!exact(intent,["kind","digestCode"])||
     !["OWNER_EVENT_REVIEW","OPERATIONS_EXCEPTION_SUMMARY"].includes(String(intent.digestCode)))
    return fail("F06_ACTION_INPUT_INVALID");
  kind="EMIT_OWNER_DIGEST";actionData=intent.digestCode as string;
 }else return fail("F06_ACTION_INPUT_INVALID");
 const event=proposeF06TypedEvent(input.eventInput);
 if(!event.ok)return fail("F06_ACTION_EVENT_UNVERIFIED");
 if(event.value.eventProposalFingerprint!==input.expectedEventFingerprint)
   return fail("F06_ACTION_FINGERPRINT_STALE");
 if(kind==="SCHEDULE_REMINDER"){
   const remind=trustedQuoteInstant(actionData);
   const asOf=trustedQuoteInstant(event.value.observedAt);
   if(remind===null||asOf===null||remind<=asOf||
      remind>asOf+7*86_400_000)return fail("F06_ACTION_REMINDER_INVALID");
 }
 const v=event.value;
 const actionFingerprint=createHash("sha256").update(JSON.stringify([
   "F06_ACTION_REVIEW_NOT_EXECUTION",v.workspaceId,v.branchId,
   v.eventType,v.sourceId,v.sourceVersion,v.eventProposalFingerprint,
   kind,actionData,
 ])).digest("hex");
 return {ok:true,value:{
   state:"F06_UNPERSISTED_INTERNAL_ACTION_PREVIEW_ONLY",
   kind,workspaceId:v.workspaceId,branchId:v.branchId,
   eventType:v.eventType,sourceId:v.sourceId,sourceVersion:v.sourceVersion,
   eventProposalFingerprint:v.eventProposalFingerprint,
   actionPreviewFingerprint:actionFingerprint,
   ...(kind==="CREATE_TASK"?{taskCode:actionData!}:{}),
   ...(kind==="REQUEST_OWNER_APPROVAL"?{approvalCode:actionData!}:{}),
   ...(kind==="SCHEDULE_REMINDER"?
     {remindAt:actionData!,reminderPurpose:"INTERNAL_OWNER_REVIEW" as const}:{}),
   ...(kind==="EMIT_OWNER_DIGEST"?{digestCode:actionData!}:{}),
   executionIdempotencyUnproven:true,serverAuthorityRequired:true,
   executionWriterUnavailable:true,businessTimeZoneUnverified:true,
   ownerApprovalRequired:true,scheduled:false,persisted:false,
   executed:false,published:false,providerCalled:false,
   customerMessageSent:false,financialStateMutated:false,
 }};
}
