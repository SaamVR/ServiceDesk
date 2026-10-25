import {createHash} from "node:crypto";
import {trustedQuoteInstant} from "@/features/operations/quote-validity-clock";

/** Human-review automation source only. A real hold release or complaint
 * response must later use tenant-scoped transactional writers. */
export type SonicF10FieldKind="DISPATCH_HOLD_EXPIRY"|"COMPLAINT_RECOVERY";
export type SonicF10FieldResult=
 | {ok:false;code:"F10_FIELD_INVALID"|"F10_FIELD_OWNER_REQUIRED"|
   "F10_FIELD_TENANT_MISMATCH"|"F10_FIELD_STALE"|"F10_FIELD_EVIDENCE_INVALID"}
 | {ok:true;value:{
   state:"F10_UNPERSISTED_FIELD_RECOVERY_REVIEW";kind:SonicF10FieldKind;
   workspaceId:string;branchId:string;sourceId:string;sourceVersion:number;
   decision:"REVIEW_RECOMMENDED"|"NOT_DUE";
   proposedTask:"REVIEW_EXPIRED_HOLD"|"REVIEW_COMPLAINT_RECOVERY"|null;
   dueAt:string;fingerprint:string|null;
   rereadCommittedSourceRequired:true;ownerApprovalRequired:true;
   holdReleased:false;crewReassigned:false;complaintClosed:false;
   refundIssued:false;customerMessageSent:false;providerCalled:false;
   saved:false;scheduled:false;executed:false;
 }};
const fail=(code:Extract<SonicF10FieldResult,{ok:false}>["code"]):SonicF10FieldResult=>({ok:false,code});
function exact(v:unknown,keys:readonly string[]):v is Record<string,unknown>{
 try{
  if(!v||typeof v!=="object"||Array.isArray(v)||
   Object.getPrototypeOf(v)!==Object.prototype)return false;
  const own=Reflect.ownKeys(v);
  return own.length===keys.length&&own.every(x=>typeof x==="string"&&keys.includes(x))&&
   keys.every(x=>Object.hasOwn(v,x))&&
   Object.values(Object.getOwnPropertyDescriptors(v)).every(x=>Object.hasOwn(x,"value"));
 }catch{return false;}
}
const id=(v:unknown):v is string=>typeof v==="string"&&
 /^[A-Za-z0-9:_-]{3,128}$/.test(v);
const version=(v:unknown):v is number=>typeof v==="number"&&
 Number.isSafeInteger(v)&&v>=1&&v<=2147483647;
const common=["kind","workspaceId","branchId","sourceId","sourceVersion"];
function typeOfRecord(v:unknown):SonicF10FieldKind|null{
 try{
  if(!v||typeof v!=="object"||Object.getPrototypeOf(v)!==Object.prototype)return null;
  const d=Object.getOwnPropertyDescriptor(v,"kind");
  return d&&Object.hasOwn(d,"value")&&
   (d.value==="DISPATCH_HOLD_EXPIRY"||d.value==="COMPLAINT_RECOVERY")?
    d.value as SonicF10FieldKind:null;
 }catch{return null;}
}
export function planSonicF10FieldRecovery(input:unknown):SonicF10FieldResult{
 if(!exact(input,["actor","workspaceId","branchId","asOf","expectedVersion","record"])||
   !exact(input.actor,["workspaceId","role"])||
   !id(input.workspaceId)||!id(input.branchId)||!id(input.actor.workspaceId)||
   !version(input.expectedVersion)||trustedQuoteInstant(input.asOf)===null)
  return fail("F10_FIELD_INVALID");
 if(input.actor.role!=="OWNER"||input.actor.workspaceId!==input.workspaceId)
  return fail("F10_FIELD_OWNER_REQUIRED");
 const r=input.record,kind=typeOfRecord(r);
 if(!kind)return fail("F10_FIELD_INVALID");
 const extra=kind==="DISPATCH_HOLD_EXPIRY"?
  ["status","holdId","expiresAt","releaseState"]:
  ["status","reportedAt","severity","responseState"];
 if(!exact(r,[...common,...extra])||
   !id(r.workspaceId)||!id(r.branchId)||!id(r.sourceId)||!version(r.sourceVersion))
  return fail("F10_FIELD_INVALID");
 if(input.workspaceId!==r.workspaceId||input.branchId!==r.branchId)
  return fail("F10_FIELD_TENANT_MISMATCH");
 if(input.expectedVersion!==r.sourceVersion)return fail("F10_FIELD_STALE");
 const now=trustedQuoteInstant(input.asOf)!;
 let due:number|null=null;
 if(kind==="DISPATCH_HOLD_EXPIRY"){
  if(r.status!=="HELD"||!id(r.holdId)||r.releaseState!=="NOT_RELEASED"||
    trustedQuoteInstant(r.expiresAt)===null)return fail("F10_FIELD_EVIDENCE_INVALID");
  due=trustedQuoteInstant(r.expiresAt);
 }else{
  if(r.status!=="OPEN"||
   !["HIGH","CRITICAL"].includes(String(r.severity))||
   r.responseState!=="NOT_RESPONDED"||
   trustedQuoteInstant(r.reportedAt)===null)
   return fail("F10_FIELD_EVIDENCE_INVALID");
  const reported=trustedQuoteInstant(r.reportedAt)!;
  due=reported+(r.severity==="CRITICAL"?0:2*3600_000);
 }
 if(due===null||!Number.isFinite(due))return fail("F10_FIELD_EVIDENCE_INVALID");
 const pending=due>now;
 const hash=pending?null:createHash("sha256").update(JSON.stringify([
  "F10_FIELD_REVIEW_NOT_EXECUTION",kind,r.workspaceId,r.branchId,
  r.sourceId,r.sourceVersion,...extra.map(k=>r[k]),
 ])).digest("hex");
 return {ok:true,value:{
  state:"F10_UNPERSISTED_FIELD_RECOVERY_REVIEW",kind,
  workspaceId:input.workspaceId as string,branchId:input.branchId as string,
  sourceId:r.sourceId as string,sourceVersion:r.sourceVersion as number,
  decision:pending?"NOT_DUE":"REVIEW_RECOMMENDED",
  proposedTask:pending?null:kind==="DISPATCH_HOLD_EXPIRY"?
   "REVIEW_EXPIRED_HOLD":"REVIEW_COMPLAINT_RECOVERY",
  dueAt:new Date(due).toISOString(),fingerprint:hash,
  rereadCommittedSourceRequired:true,ownerApprovalRequired:true,
  holdReleased:false,crewReassigned:false,complaintClosed:false,
  refundIssued:false,customerMessageSent:false,providerCalled:false,
  saved:false,scheduled:false,executed:false,
 }};
}
