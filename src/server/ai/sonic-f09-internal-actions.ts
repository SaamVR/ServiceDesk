import { createHash } from "node:crypto";
import { trustedQuoteInstant } from "@/features/operations/quote-validity-clock";
import { proposeSonicF09Event } from "./sonic-f09-event-families";

/** Four new source-level SONIC internal actions. None is a deployed
 * WorkflowActionType or writer; no provider, N8N, customer or money call. */
export const SONIC_F09_ACTION_TYPES = [
 "SET_INTERNAL_PRIORITY","CREATE_DRAFT_REPLY","SUGGEST_SLOT",
 "START_N8N_APPROVED_JOB",
] as const;
export type SonicF09ActionType = typeof SONIC_F09_ACTION_TYPES[number];
export type SonicF09ActionResult =
 | {ok:false;code:"F09_ACTION_INVALID"|"F09_ACTION_SOURCE_UNVERIFIED"|
    "F09_ACTION_STALE"|"F09_ACTION_TIME_INVALID"}
 | {ok:true;value:{
    state:"UNPERSISTED_F09_INTERNAL_ACTION_DRAFT";kind:SonicF09ActionType;
    workspaceId:string;branchId:string;sourceId:string;sourceVersion:number;
    eventFingerprint:string;actionFingerprint:string;intentCode:string;
    externalDelivery:false;executed:false;saved:false;scheduled:false;
    appointmentConfirmed:false;providerCalled:false;n8nCalled:false;
    customerMessageSent:false;financialStateChanged:false;
    branchAuthorityRequiresFreshRead:true;ownerApprovalRequired:true;
    savedSourceRequiresFreshRead:true;idempotentWriterUnavailable:true;
    sourceAuthenticated:false;
 }};
const fail=(code:Extract<SonicF09ActionResult,{ok:false}>["code"]):SonicF09ActionResult=>({ok:false,code});
function exact(v:unknown,keys:readonly string[]):v is Record<string,unknown>{
 try{
  if(!v||typeof v!=="object"||Array.isArray(v)||
   Object.getPrototypeOf(v)!==Object.prototype)return false;
  const own=Reflect.ownKeys(v);
  return own.length===keys.length&&
   !own.some(x=>typeof x!=="string"||!keys.includes(x))&&
   keys.every(x=>Object.hasOwn(v,x))&&
   Object.values(Object.getOwnPropertyDescriptors(v)).every(d=>Object.hasOwn(d,"value"));
 }catch{return false;}
}
const id=(v:unknown):v is string=>typeof v==="string"&&
 /^[A-Za-z0-9:_-]{3,128}$/.test(v);
export function draftSonicF09Action(input:unknown):SonicF09ActionResult{
 if(!exact(input,["eventInput","expectedEventFingerprint","intent"])||
   typeof input.expectedEventFingerprint!=="string"||
   !/^[a-f0-9]{64}$/.test(input.expectedEventFingerprint)||
   !input.intent||typeof input.intent!=="object")
  return fail("F09_ACTION_INVALID");
 const intent=input.intent;
 let kind:SonicF09ActionType;
 let code:string;
 if(exact(intent,["kind","attentionId","priority"])&&
    intent.kind==="SET_INTERNAL_PRIORITY"&&id(intent.attentionId)&&
    ["LOW","NORMAL","HIGH","CRITICAL"].includes(String(intent.priority))){
   kind="SET_INTERNAL_PRIORITY";code=String(intent.attentionId)+":"+String(intent.priority);
 }else if(exact(intent,["kind","channel","templateCode"])&&
    intent.kind==="CREATE_DRAFT_REPLY"&&
    ["EMAIL","WHATSAPP"].includes(String(intent.channel))&&
    ["CLARIFY_DETAILS","FOLLOW_UP_QUOTE","APPOINTMENT_CHECK"].includes(String(intent.templateCode))){
   kind="CREATE_DRAFT_REPLY";code=String(intent.channel)+":"+String(intent.templateCode);
 }else if(exact(intent,["kind","crewId","suggestedStartAt"])&&
    intent.kind==="SUGGEST_SLOT"&&id(intent.crewId)&&
    trustedQuoteInstant(intent.suggestedStartAt)!==null){
   kind="SUGGEST_SLOT";code=String(intent.crewId)+":"+String(intent.suggestedStartAt);
 }else if(exact(intent,["kind","approvedJobCode"])&&
    intent.kind==="START_N8N_APPROVED_JOB"&&
    ["OWNER_AUDIT_EXPORT","INTERNAL_OPERATIONS_SYNC"].includes(String(intent.approvedJobCode))){
   // A known identifier here is NOT permission to invoke an N8N endpoint.
   // Writer must recheck a trusted config allowlist and explicit approval.
   kind="START_N8N_APPROVED_JOB";code=String(intent.approvedJobCode);
 }else return fail("F09_ACTION_INVALID");
 const event=proposeSonicF09Event(input.eventInput);
 if(!event.ok)return fail("F09_ACTION_SOURCE_UNVERIFIED");
 if(event.value.fingerprint!==input.expectedEventFingerprint)
   return fail("F09_ACTION_STALE");
 if(kind==="SUGGEST_SLOT"){
  const at=trustedQuoteInstant((intent as Record<string,unknown>).suggestedStartAt);
  const now=trustedQuoteInstant(event.value.asOf);
  if(at===null||now===null||at<=now||at>now+30*86400_000)
    return fail("F09_ACTION_TIME_INVALID");
 }
 const e=event.value;
 const fingerprint=createHash("sha256").update(JSON.stringify([
  "F09_ACTION_DRAFT_NOT_EXECUTION",e.workspaceId,e.branchId,
  e.sourceId,e.sourceVersion,e.fingerprint,kind,code,
 ])).digest("hex");
 return {ok:true,value:{
  state:"UNPERSISTED_F09_INTERNAL_ACTION_DRAFT",kind,
  workspaceId:e.workspaceId,branchId:e.branchId,sourceId:e.sourceId,
  sourceVersion:e.sourceVersion,eventFingerprint:e.fingerprint,
  actionFingerprint:fingerprint,intentCode:code,
  externalDelivery:false,executed:false,saved:false,scheduled:false,
  appointmentConfirmed:false,providerCalled:false,n8nCalled:false,
  customerMessageSent:false,financialStateChanged:false,
  branchAuthorityRequiresFreshRead:true,ownerApprovalRequired:true,
  savedSourceRequiresFreshRead:true,idempotentWriterUnavailable:true,
  sourceAuthenticated:false,
 }};
}
