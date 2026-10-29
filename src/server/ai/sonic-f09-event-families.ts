import { createHash } from "node:crypto";
import { trustedQuoteInstant } from "@/features/operations/quote-validity-clock";

/** F09 adds missing SONIC EVENT *CANDIDATES*. They are not yet shared
 * WorkflowEventType entries, committed journal events, or live triggers. */
export const SONIC_F09_EVENT_TYPES = [
  "MESSAGE_RECEIVED","QUOTE_SENT","CREW_ASSIGNED","INCIDENT_REPORTED",
  "QA_FAILED","INVOICE_ISSUED","PAYMENT_FAILED","RECURRING_VISIT_DUE",
] as const;
export type SonicF09EventType = typeof SONIC_F09_EVENT_TYPES[number];
export type SonicF09EventResult =
 | {ok:false;code:"F09_INVALID_INPUT"|"F09_OWNER_REQUIRED"|"F09_SCOPE_MISMATCH"|
     "F09_SOURCE_STALE"|"F09_EVIDENCE_INVALID"|"F09_NOT_DUE"}
 | {ok:true;value:{
   state:"UNPERSISTED_F09_EVENT_CANDIDATE";kind:SonicF09EventType;
   workspaceId:string;branchId:string;sourceId:string;sourceVersion:number;
   evidenceAt:string;asOf:string;fingerprint:string;
   sourceAuthenticated:false;publisherAuthorized:false;ownerApprovalRequired:true;
   emitted:false;executed:false;scheduled:false;providerCalled:false;
   customerMessageSent:false;moneyChanged:false;
 }};
const base=["kind","workspaceId","branchId","sourceId","sourceVersion"] as const;
const fields:Record<SonicF09EventType,readonly string[]>={
 MESSAGE_RECEIVED:["status","channel","receivedAt","messageId"],
 QUOTE_SENT:["status","sentAt","outboxId"],
 CREW_ASSIGNED:["status","assignedAt","crewId"],
 INCIDENT_REPORTED:["status","reportedAt","severity"],
 QA_FAILED:["status","reviewedAt","reviewerId"],
 INVOICE_ISSUED:["status","issuedAt","totalMinor"],
 PAYMENT_FAILED:["status","failedAt","providerReceiptId"],
 RECURRING_VISIT_DUE:["status","nextDueAt","recurrenceId"],
};
const fail=(code:Extract<SonicF09EventResult,{ok:false}>["code"]):SonicF09EventResult=>
 ({ok:false,code});
const safeId=(value:unknown):value is string=>
 typeof value==="string"&&/^[A-Za-z0-9:_-]{3,128}$/.test(value);
const version=(v:unknown):v is number=>typeof v==="number"&&
 Number.isSafeInteger(v)&&v>=1&&v<=2147483647;
const money=(v:unknown):v is number=>typeof v==="number"&&
 Number.isSafeInteger(v)&&v>=0&&v<=Number.MAX_SAFE_INTEGER;
function exact(value:unknown,keys:readonly string[]):value is Record<string,unknown>{
 try{
  if(!value||typeof value!=="object"||Array.isArray(value)||
    Object.getPrototypeOf(value)!==Object.prototype)return false;
  const own=Reflect.ownKeys(value);
  if(own.length!==keys.length||own.some(k=>typeof k!=="string"||!keys.includes(k))||
    !keys.every(k=>Object.hasOwn(value,k)))return false;
  return Object.values(Object.getOwnPropertyDescriptors(value)).every(d=>
    Object.hasOwn(d,"value"));
 }catch{return false;}
}
/** Pure typed proposal from a caller's claimed persisted projection. The
 * DB must reauthenticate source/branch/version and record an atomic event
 * before any newly defined trigger may enter the existing runtime. */
export function proposeSonicF09Event(input:unknown):SonicF09EventResult{
 if(!exact(input,["actor","workspaceId","branchId","asOf","expectedVersion","record"])||
   !exact(input.actor,["workspaceId","role"])||
   !safeId(input.workspaceId)||!safeId(input.branchId)||
   !safeId(input.actor.workspaceId)||!version(input.expectedVersion)||
   trustedQuoteInstant(input.asOf)===null)return fail("F09_INVALID_INPUT");
 if(input.actor.role!=="OWNER"||input.actor.workspaceId!==input.workspaceId)
   return fail("F09_OWNER_REQUIRED");
 const r=input.record;
 let kind:unknown;
 try{
  if(!r||typeof r!=="object"||Array.isArray(r)||
     Object.getPrototypeOf(r)!==Object.prototype)return fail("F09_INVALID_INPUT");
  const descriptor=Object.getOwnPropertyDescriptor(r,"kind");
  kind=descriptor&&Object.hasOwn(descriptor,"value")?descriptor.value:undefined;
 }catch{return fail("F09_INVALID_INPUT");}
 if(typeof kind!=="string"||!Object.hasOwn(fields,kind))return fail("F09_INVALID_INPUT");
 const k=kind as SonicF09EventType;
 if(!exact(r,[...base,...fields[k]])||!safeId(r.workspaceId)||
   !safeId(r.branchId)||!safeId(r.sourceId)||!version(r.sourceVersion))
   return fail("F09_INVALID_INPUT");
 if(r.workspaceId!==input.workspaceId||r.branchId!==input.branchId)
   return fail("F09_SCOPE_MISMATCH");
 if(r.sourceVersion!==input.expectedVersion)return fail("F09_SOURCE_STALE");
 const now=trustedQuoteInstant(input.asOf)!;
 let evidenceAt:unknown;
 switch(k){
  case "MESSAGE_RECEIVED":
   if(r.status!=="RECEIVED"||!["EMAIL","WHATSAPP"].includes(String(r.channel))||
      !safeId(r.messageId))return fail("F09_EVIDENCE_INVALID");
   evidenceAt=r.receivedAt;break;
  case "QUOTE_SENT":
   if(r.status!=="SENT"||!safeId(r.outboxId))return fail("F09_EVIDENCE_INVALID");
   evidenceAt=r.sentAt;break;
  case "CREW_ASSIGNED":
   if(r.status!=="ASSIGNED"||!safeId(r.crewId))return fail("F09_EVIDENCE_INVALID");
   evidenceAt=r.assignedAt;break;
  case "INCIDENT_REPORTED":
   if(r.status!=="OPEN"||!["LOW","MEDIUM","HIGH"].includes(String(r.severity)))
     return fail("F09_EVIDENCE_INVALID");
   evidenceAt=r.reportedAt;break;
  case "QA_FAILED":
   if(r.status!=="FAILED"||!safeId(r.reviewerId))return fail("F09_EVIDENCE_INVALID");
   evidenceAt=r.reviewedAt;break;
  case "INVOICE_ISSUED":
   if(r.status!=="ISSUED"||!money(r.totalMinor)||r.totalMinor===0)
     return fail("F09_EVIDENCE_INVALID");
   evidenceAt=r.issuedAt;break;
  case "PAYMENT_FAILED":
   if(r.status!=="FAILED"||!safeId(r.providerReceiptId))
     return fail("F09_EVIDENCE_INVALID");
   evidenceAt=r.failedAt;break;
  case "RECURRING_VISIT_DUE":
   if(r.status!=="ACTIVE"||!safeId(r.recurrenceId))
     return fail("F09_EVIDENCE_INVALID");
   evidenceAt=r.nextDueAt;break;
 }
 const at=trustedQuoteInstant(evidenceAt);
 if(at===null)return fail("F09_EVIDENCE_INVALID");
 if(at>now)
   return fail("F09_NOT_DUE");
 const fingerprint=createHash("sha256").update(JSON.stringify([
  "F09_EVENT_PROPOSAL_NOT_COMMIT",k,input.workspaceId,input.branchId,
  r.sourceId,r.sourceVersion,evidenceAt,
  // Bind every allowlisted saved state/evidence field, not only the timestamp.
  ...fields[k].map(field=>r[field]),
 ])).digest("hex");
 return {ok:true,value:{
  state:"UNPERSISTED_F09_EVENT_CANDIDATE",kind:k,
  workspaceId:input.workspaceId as string,branchId:input.branchId as string,
  sourceId:r.sourceId as string,sourceVersion:r.sourceVersion as number,
  evidenceAt:evidenceAt as string,asOf:input.asOf as string,fingerprint,
  sourceAuthenticated:false,publisherAuthorized:false,ownerApprovalRequired:true,
  emitted:false,executed:false,scheduled:false,providerCalled:false,
  customerMessageSent:false,moneyChanged:false,
 }};
}
