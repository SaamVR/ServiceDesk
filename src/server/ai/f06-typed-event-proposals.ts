import {createHash} from "node:crypto";
import {trustedQuoteInstant} from "@/features/operations/quote-validity-clock";

/** F06 event types are PROPOSALS, not members of the shipped WorkflowEventType
 * or a new persisted trigger. Production owns the future contracts/SQL.
 */
export type F06ProposedEventType=
  "QUOTE_EXPIRED"|"BOOKING_CONFIRMED"|"VISIT_DELAYED"|"INVOICE_OVERDUE";
export interface F06EventRecordScope{
  workspaceId:string;branchId:string;sourceId:string;sourceVersion:number;
}
export type F06SourceRecord=
 | (F06EventRecordScope & {
     eventType:"QUOTE_EXPIRED";status:"SENT";validUntil:string;
   })
 | (F06EventRecordScope & {
     eventType:"BOOKING_CONFIRMED";status:"CONFIRMED";
     confirmedAt:string;scheduledStartAt:string;
   })
 | (F06EventRecordScope & {
     eventType:"VISIT_DELAYED";status:"EN_ROUTE"|"IN_PROGRESS";
     delayState:"PERSISTED_DELAY_RECORDED";scheduledStartAt:string;
     delayRecordedAt:string;recordedDelayMinutes:number;
   })
 | (F06EventRecordScope & {
     eventType:"INVOICE_OVERDUE";status:"ISSUED"|"PARTIALLY_PAID";
     dueAt:string;totalMinor:number;balanceMinor:number;
   });
export interface F06TypedEventInput {
  actor:{workspaceId:string;role:"OWNER"|"DISPATCHER"|"CREW"|"CUSTOMER"};
  workspaceId:string;branchId:string;
  observedAt:string;
  expectedSourceVersion:number;
  record:F06SourceRecord;
}
export type F06TypedEventResult=
 | {ok:false;code:"F06_EVENT_INPUT_INVALID"|"F06_EVENT_OWNER_REQUIRED"|
   "F06_EVENT_TENANT_MISMATCH"|"F06_EVENT_VERSION_STALE"|
   "F06_EVENT_SAVED_EVIDENCE_MISSING"|"F06_EVENT_NOT_DUE"}
 | {ok:true;value:{
   state:"F06_UNPERSISTED_EVENT_CANDIDATE_ONLY";
   eventType:F06ProposedEventType;
   workspaceId:string;branchId:string;sourceId:string;sourceVersion:number;
   sourceEvidence:"CALLER_SUPPLIED_SAVED_PROJECTION_UNVERIFIED";
   evidenceTime:string;observedAt:string;
   eventProposalFingerprint:string;
   sourceVersionMustBeRechecked:true;
   persistedSourceMustBeReauthenticated:true;
   branchAuthorityUnverified:true;
   recordedActionProofUnavailable:true;
   ownerApprovalRequired:true;
   emitted:false;executed:false;published:false;
   providerCalled:false;customerMessageSent:false;moneyChanged:false;
 }};
const fail=(code:Extract<F06TypedEventResult,{ok:false}>["code"]):F06TypedEventResult=>({ok:false,code});
const id=(v:unknown):v is string=>typeof v==="string"&&/^[A-Za-z0-9:_-]{3,128}$/.test(v);
const validTime=(v:unknown):number|null=>trustedQuoteInstant(v);
function exact(v:unknown,keys:readonly string[]):v is Record<string,unknown>{
 try{
   if(!v||typeof v!=="object"||Array.isArray(v)||
      Object.getPrototypeOf(v)!==Object.prototype)return false;
   const own=Reflect.ownKeys(v);
   if(own.length!==keys.length||!keys.every(k=>Object.hasOwn(v,k))||
      own.some(k=>typeof k!=="string"||!keys.includes(k)))return false;
   return Object.values(Object.getOwnPropertyDescriptors(v))
     .every(d=>Object.hasOwn(d,"value"));
 }catch{return false;}
}
const base=["eventType","workspaceId","branchId","sourceId","sourceVersion"] as const;
const extra:Record<F06ProposedEventType,readonly string[]>={
 QUOTE_EXPIRED:["status","validUntil"],
 BOOKING_CONFIRMED:["status","confirmedAt","scheduledStartAt"],
 VISIT_DELAYED:["status","delayState","scheduledStartAt","delayRecordedAt","recordedDelayMinutes"],
 INVOICE_OVERDUE:["status","dueAt","totalMinor","balanceMinor"],
};
const validSourceVersion=(v:unknown):v is number=>
 typeof v==="number"&&Number.isSafeInteger(v)&&v>0&&v<=2147483647;
const validMoney=(v:unknown):v is number=>
 typeof v==="number"&&Number.isSafeInteger(v)&&v>=0&&v<=Number.MAX_SAFE_INTEGER;

/** Validate supplied projections without mistaking caller-provided evidence
 * for an authenticated database record. No event is emitted, no task queued.
 * Callers MUST independently prove the source fields against current, scoped
 * committed rows at the execution boundary.
 */
export function proposeF06TypedEvent(input:unknown):F06TypedEventResult{
 if(!exact(input,["actor","workspaceId","branchId","observedAt",
   "expectedSourceVersion","record"])||
   !exact(input.actor,["workspaceId","role"])||
   !id(input.workspaceId)||!id(input.branchId)||
   !id(input.actor.workspaceId)||!validSourceVersion(input.expectedSourceVersion)||
   validTime(input.observedAt)===null||
   !input.record||typeof input.record!=="object"||Array.isArray(input.record))
   return fail("F06_EVENT_INPUT_INVALID");
 if(input.actor.role!=="OWNER"||input.actor.workspaceId!==input.workspaceId)
   return fail("F06_EVENT_OWNER_REQUIRED");
 const record=input.record as Record<string,unknown>;
 const kind=record.eventType;
 if(typeof kind!=="string"||!Object.hasOwn(extra,kind))
   return fail("F06_EVENT_INPUT_INVALID");
 const eventType=kind as F06ProposedEventType;
 if(!exact(record,[...base,...extra[eventType]])||
   !id(record.workspaceId)||!id(record.branchId)||!id(record.sourceId)||
   !validSourceVersion(record.sourceVersion))
   return fail("F06_EVENT_INPUT_INVALID");
 if(record.workspaceId!==input.workspaceId||record.branchId!==input.branchId)
   return fail("F06_EVENT_TENANT_MISMATCH");
 if(record.sourceVersion!==input.expectedSourceVersion)
   return fail("F06_EVENT_VERSION_STALE");
 const observed=validTime(input.observedAt)!;
 let evidenceTime:string|null=null;
 if(eventType==="QUOTE_EXPIRED"){
   if(record.status!=="SENT"||validTime(record.validUntil)===null)
      return fail("F06_EVENT_SAVED_EVIDENCE_MISSING");
   if(validTime(record.validUntil)!>observed)return fail("F06_EVENT_NOT_DUE");
   evidenceTime=record.validUntil as string;
 }else if(eventType==="BOOKING_CONFIRMED"){
   const confirmed=validTime(record.confirmedAt),scheduled=validTime(record.scheduledStartAt);
   if(record.status!=="CONFIRMED"||confirmed===null||scheduled===null)
      return fail("F06_EVENT_SAVED_EVIDENCE_MISSING");
   if(confirmed>observed||confirmed>scheduled)return fail("F06_EVENT_NOT_DUE");
   evidenceTime=record.confirmedAt as string;
 }else if(eventType==="VISIT_DELAYED"){
   const start=validTime(record.scheduledStartAt),delay=validTime(record.delayRecordedAt);
   if(!["EN_ROUTE","IN_PROGRESS"].includes(String(record.status))||
      record.delayState!=="PERSISTED_DELAY_RECORDED"||
      start===null||delay===null||
      !Number.isSafeInteger(record.recordedDelayMinutes)||
      Number(record.recordedDelayMinutes)<1||Number(record.recordedDelayMinutes)>1440)
      return fail("F06_EVENT_SAVED_EVIDENCE_MISSING");
   if(delay>observed||delay<=start)return fail("F06_EVENT_NOT_DUE");
   evidenceTime=record.delayRecordedAt as string;
 }else{
   const due=validTime(record.dueAt);
   if(!["ISSUED","PARTIALLY_PAID"].includes(String(record.status))||
      due===null||!validMoney(record.totalMinor)||!validMoney(record.balanceMinor)||
      record.totalMinor===0||record.balanceMinor===0||
      Number(record.balanceMinor)>Number(record.totalMinor))
     return fail("F06_EVENT_SAVED_EVIDENCE_MISSING");
   if(due>=observed)return fail("F06_EVENT_NOT_DUE");
   evidenceTime=record.dueAt as string;
 }
 // This is a stable candidate fingerprint, NOT a durable workflow execution
 // key, not a provider receipt, and not an idempotent execution guarantee.
 const fingerprint=createHash("sha256").update(JSON.stringify([
   "F06_CANDIDATE",eventType,input.workspaceId,input.branchId,
   record.sourceId,record.sourceVersion,evidenceTime,
 ])).digest("hex");
 return {ok:true,value:{
   state:"F06_UNPERSISTED_EVENT_CANDIDATE_ONLY",eventType,
   workspaceId:input.workspaceId as string,branchId:input.branchId as string,
   sourceId:record.sourceId as string,sourceVersion:record.sourceVersion as number,
   sourceEvidence:"CALLER_SUPPLIED_SAVED_PROJECTION_UNVERIFIED",
   evidenceTime,observedAt:input.observedAt as string,
   eventProposalFingerprint:fingerprint,
   sourceVersionMustBeRechecked:true,persistedSourceMustBeReauthenticated:true,
   branchAuthorityUnverified:true,recordedActionProofUnavailable:true,
   ownerApprovalRequired:true,emitted:false,executed:false,published:false,
   providerCalled:false,customerMessageSent:false,moneyChanged:false,
 }};
}
