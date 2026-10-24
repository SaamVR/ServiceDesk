/** Owner-only, saved-receipt-based automation failure triage. This module
 * does not enqueue retries or imply an AI/model/provider action occurred. */
export type FailureClass="CONFIGURATION_BLOCKED"|"TRANSIENT_FAILURE"|"PERMANENT_FAILURE"|"RETRY_EXHAUSTED";
export interface SavedAutomationFailure {
  workspaceId:string;executionId:string;eventId:string;status:FailureClass;
  occurredAt:string;attempts:number;maxAttempts:number;
}
export interface AutomationTriageInput {
  actor:{workspaceId:string;role:string};workspaceId:string;now:string;
  failures:readonly SavedAutomationFailure[];
}
export type AutomationTriageResult=
 | {ok:false;code:"AUTOMATION_TRIAGE_OWNER_REQUIRED"|"AUTOMATION_TRIAGE_EVIDENCE_INVALID"}
 | {ok:true;value:{
   state:"OWNER_AUTOMATION_FAILURE_REVIEW_ONLY";source:"SAVED_SCOPED_FAILURE_RECEIPTS";
   workspaceId:string;inspected:number;operatorReviewCount:number;retryCandidateCount:number;
   items:Array<{executionId:string;eventId:string;status:FailureClass;
     action:"CHECK_CONFIGURATION"|"REVIEW_PERMANENT_FAILURE"|"REVIEW_RETRY_BUDGET"|"REVIEW_TRANSIENT_RETRY";
     attempts:number;maxAttempts:number;ownerApprovalRequired:true}>;
   retriesEnqueued:false;messagesSent:false;businessStateChanged:false;modelInvoked:false;
 }};
const id=(v:unknown):v is string=>typeof v==="string"&&/^[A-Za-z0-9:_-]{3,128}$/.test(v);
const exactUtc=(v:unknown):v is string=>typeof v==="string" &&
 /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v) &&
 Number.isFinite(Date.parse(v))&&new Date(Date.parse(v)).toISOString()===v;
const states:readonly FailureClass[]=["CONFIGURATION_BLOCKED","TRANSIENT_FAILURE","PERMANENT_FAILURE","RETRY_EXHAUSTED"];
const keys=["workspaceId","executionId","eventId","status","occurredAt","attempts","maxAttempts"];
function exactReceipt(v:unknown):v is SavedAutomationFailure {
 if(!v||typeof v!=="object"||Array.isArray(v)||
   Object.getPrototypeOf(v)!==Object.prototype ||
   Reflect.ownKeys(v).length!==keys.length ||
   Object.keys(v).length!==keys.length ||
   keys.some(k=>!Object.hasOwn(v,k)) ||
   Object.values(Object.getOwnPropertyDescriptors(v)).some(d=>!Object.hasOwn(d,"value")))return false;
 const r=v as Record<string,unknown>;
 return id(r.workspaceId)&&id(r.executionId)&&id(r.eventId)&&
   states.includes(r.status as FailureClass)&&exactUtc(r.occurredAt)&&
   Number.isSafeInteger(r.attempts)&&Number.isSafeInteger(r.maxAttempts)&&
   (r.attempts as number)>=0&&(r.maxAttempts as number)>=1&&
   (r.maxAttempts as number)<=12&&(r.attempts as number)<=12;
}
export function planOwnerAutomationFailureTriage(input:AutomationTriageInput):AutomationTriageResult {
 if(!input || !input.actor || input.actor.role!=="OWNER" ||
   !id(input.workspaceId) || input.actor.workspaceId!==input.workspaceId)
   return {ok:false,code:"AUTOMATION_TRIAGE_OWNER_REQUIRED"};
 if(!exactUtc(input.now)||!Array.isArray(input.failures)||
   input.failures.length>=250||
   Reflect.ownKeys(input.failures).length!==input.failures.length+1)
   return {ok:false,code:"AUTOMATION_TRIAGE_EVIDENCE_INVALID"};
 const seen=new Set<string>();
 const items:Extract<AutomationTriageResult,{ok:true}>["value"]["items"]=[];
 for(let i=0;i<input.failures.length;i++){
   const descriptor=Object.getOwnPropertyDescriptor(input.failures,String(i));
   if(!descriptor||!Object.hasOwn(descriptor,"value")||
      descriptor.enumerable!==true)return {ok:false,code:"AUTOMATION_TRIAGE_EVIDENCE_INVALID"};
   const receipt=input.failures[i];
   if(!exactReceipt(receipt)||receipt.workspaceId!==input.workspaceId||
      seen.has(receipt.executionId)||Date.parse(receipt.occurredAt)>Date.parse(input.now))
     return {ok:false,code:"AUTOMATION_TRIAGE_EVIDENCE_INVALID"};
   seen.add(receipt.executionId);
   // A transient failure with exhausted attempts cannot be approved as a
   // retry candidate just because a provider labelled it transient.
   const action=receipt.status==="CONFIGURATION_BLOCKED"?"CHECK_CONFIGURATION" as const:
     receipt.status==="PERMANENT_FAILURE"?"REVIEW_PERMANENT_FAILURE" as const:
     receipt.status==="RETRY_EXHAUSTED"||receipt.attempts>=receipt.maxAttempts ?
       "REVIEW_RETRY_BUDGET" as const:"REVIEW_TRANSIENT_RETRY" as const;
   items.push({executionId:receipt.executionId,eventId:receipt.eventId,
     status:receipt.status,action,attempts:receipt.attempts,
     maxAttempts:receipt.maxAttempts,ownerApprovalRequired:true});
 }
 const priority={CHECK_CONFIGURATION:0,REVIEW_RETRY_BUDGET:1,REVIEW_PERMANENT_FAILURE:2,REVIEW_TRANSIENT_RETRY:3};
 items.sort((a,b)=>priority[a.action]-priority[b.action]||
   a.executionId.localeCompare(b.executionId));
 return {ok:true,value:{
   state:"OWNER_AUTOMATION_FAILURE_REVIEW_ONLY",source:"SAVED_SCOPED_FAILURE_RECEIPTS",
   workspaceId:input.workspaceId,inspected:items.length,
   operatorReviewCount:items.filter(i=>i.action!=="REVIEW_TRANSIENT_RETRY").length,
   retryCandidateCount:items.filter(i=>i.action==="REVIEW_TRANSIENT_RETRY").length,
   items,retriesEnqueued:false,messagesSent:false,
   businessStateChanged:false,modelInvoked:false,
 }};
}
