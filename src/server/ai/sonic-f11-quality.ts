import {createHash} from "node:crypto";
import {trustedQuoteInstant} from "@/features/operations/quote-validity-clock";

/** F11 quality review proposals from caller-claimed saved projections.
 * Never persist, schedule, notify, charge, dispatch or claim a provider receipt. */
export const SONIC_F11_Quality_KINDS=["CHECKLIST_GAP_REVIEW","INCIDENT_ESCALATION_REVIEW"] as const;
export type SonicF11QualityKind=typeof SONIC_F11_Quality_KINDS[number];
export type SonicF11QualityResult=
 | {ok:false;code:"F11_Quality_INPUT_INVALID"|"F11_Quality_OWNER_REQUIRED"|
   "F11_Quality_SCOPE_MISMATCH"|"F11_Quality_STALE"|"F11_Quality_EVIDENCE_INVALID"}
 | {ok:true;value:{
   state:"F11_UNPERSISTED_OWNER_REVIEW";kind:SonicF11QualityKind;
   workspaceId:string;branchId:string;sourceId:string;sourceVersion:number;
   decision:"REVIEW_RECOMMENDED"|"NOT_DUE";proposedTask:"REVIEW_INCOMPLETE_CHECKLIST"|"REVIEW_FIELD_INCIDENT"|null;
   dueAt:string;fingerprint:string|null;sourceAuthenticationRequired:true;
   humanApprovalRequired:true;saved:false;scheduled:false;executed:false;
   providerCalled:false;customerMessageSent:false;financialMutation:false;
   bookingChanged:false;recordChanged:false;
 }};
const fail=(code:Extract<SonicF11QualityResult,{ok:false}>["code"]):SonicF11QualityResult=>({ok:false,code});
function exact(v:unknown,keys:readonly string[]):v is Record<string,unknown>{
 try {
  if(!v||typeof v!=="object"||Array.isArray(v)||Object.getPrototypeOf(v)!==Object.prototype)return false;
  const own=Reflect.ownKeys(v);
  return own.length===keys.length && own.every(k=>typeof k==="string"&&keys.includes(k)) &&
   keys.every(k=>Object.hasOwn(v,k)) &&
   Object.values(Object.getOwnPropertyDescriptors(v)).every(d=>Object.hasOwn(d,"value"));
 } catch {return false;}
}
const id=(v:unknown):v is string=>typeof v==="string"&&/^[A-Za-z0-9:_-]{3,128}$/.test(v);
const vers=(v:unknown):v is number=>typeof v==="number"&&Number.isSafeInteger(v)&&v>=1&&v<=2147483647;
const common=["kind","workspaceId","branchId","sourceId","sourceVersion"];
const extras:Record<SonicF11QualityKind,readonly string[]>={
 CHECKLIST_GAP_REVIEW:["status","requiredCount","completedCount","scheduledEndAt"],
 INCIDENT_ESCALATION_REVIEW:["status","severity","observedAt","mitigatedAt"],
};
const tasks:Record<SonicF11QualityKind,NonNullable<Extract<SonicF11QualityResult,{ok:true}>["value"]["proposedTask"]>>={
 CHECKLIST_GAP_REVIEW:"REVIEW_INCOMPLETE_CHECKLIST",
 INCIDENT_ESCALATION_REVIEW:"REVIEW_FIELD_INCIDENT"
};
function ownedKind(v:unknown):SonicF11QualityKind|null{
 try {
  if(!v||typeof v!=="object"||Array.isArray(v)||Object.getPrototypeOf(v)!==Object.prototype)return null;
  const d=Object.getOwnPropertyDescriptor(v,"kind");
  return d&&Object.hasOwn(d,"value")&&typeof d.value==="string"&&
   Object.hasOwn(extras,d.value)?d.value as SonicF11QualityKind:null;
 } catch {return null;}
}
export function planSonicF11Quality(input:unknown):SonicF11QualityResult{
 try {
  if(!exact(input,["actor","workspaceId","branchId","asOf","expectedVersion","record"])||
   !exact(input.actor,["workspaceId","role"])||!id(input.workspaceId)||!id(input.branchId)||
   !id(input.actor.workspaceId)||!vers(input.expectedVersion))
   return fail("F11_Quality_INPUT_INVALID");
  const now=trustedQuoteInstant(input.asOf);
  if(now===null)return fail("F11_Quality_INPUT_INVALID");
  if(input.actor.role!=="OWNER"||input.actor.workspaceId!==input.workspaceId)
   return fail("F11_Quality_OWNER_REQUIRED");
  const r=input.record,kind=ownedKind(r);
  if(!kind||!exact(r,[...common,...extras[kind]])||!id(r.workspaceId)||!id(r.branchId)||
   !id(r.sourceId)||!vers(r.sourceVersion))return fail("F11_Quality_INPUT_INVALID");
  if(r.workspaceId!==input.workspaceId||r.branchId!==input.branchId)
   return fail("F11_Quality_SCOPE_MISMATCH");
  if(r.sourceVersion!==input.expectedVersion)return fail("F11_Quality_STALE");
  let due:number|null=null;
  if(kind==="CHECKLIST_GAP_REVIEW"){
   if(r.status!=="IN_PROGRESS"||typeof r.requiredCount!=="number"||
    !Number.isSafeInteger(r.requiredCount)||r.requiredCount<1||r.requiredCount>200||
    typeof r.completedCount!=="number"||!Number.isSafeInteger(r.completedCount)||
    r.completedCount<0||r.completedCount>=r.requiredCount||
    trustedQuoteInstant(r.scheduledEndAt)===null)return fail("F11_QUALITY_EVIDENCE_INVALID");
   due=trustedQuoteInstant(r.scheduledEndAt);
  }else{
   if(r.status!=="OPEN"||!["HIGH","CRITICAL"].includes(String(r.severity))||
    r.mitigatedAt!==null||trustedQuoteInstant(r.observedAt)===null||
    trustedQuoteInstant(r.observedAt)!>now)return fail("F11_QUALITY_EVIDENCE_INVALID");
   due=trustedQuoteInstant(r.observedAt)!+(r.severity==="CRITICAL"?0:30*60_000);
  }
  if(due===null||!Number.isFinite(due))return fail("F11_Quality_EVIDENCE_INVALID");
  const pending=due>now;
  const fingerprint=pending?null:createHash("sha256").update(JSON.stringify([
   "F11_Quality_UNPERSISTED_NOT_EXECUTION",kind,r.workspaceId,r.branchId,r.sourceId,
   r.sourceVersion,...extras[kind].map(field=>r[field]),
  ])).digest("hex");
  return {ok:true,value:{
   state:"F11_UNPERSISTED_OWNER_REVIEW",kind,
   workspaceId:input.workspaceId as string,branchId:input.branchId as string,
   sourceId:r.sourceId as string,sourceVersion:r.sourceVersion as number,
   decision:pending?"NOT_DUE":"REVIEW_RECOMMENDED",
   proposedTask:pending?null:tasks[kind],dueAt:new Date(due).toISOString(),
   fingerprint,sourceAuthenticationRequired:true,humanApprovalRequired:true,
   saved:false,scheduled:false,executed:false,providerCalled:false,
   customerMessageSent:false,financialMutation:false,bookingChanged:false,recordChanged:false,
  }};
 } catch {return fail("F11_Quality_INPUT_INVALID");}
}
