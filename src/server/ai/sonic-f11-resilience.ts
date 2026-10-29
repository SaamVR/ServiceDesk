import {createHash} from "node:crypto";
import {trustedQuoteInstant} from "@/features/operations/quote-validity-clock";

/** F11 resilience review proposals from caller-claimed saved projections.
 * Never persist, schedule, notify, charge, dispatch or claim a provider receipt. */
export const SONIC_F11_RESILIENCE_KINDS=["PROVIDER_HEALTH_REVIEW","OUTBOX_DEAD_LETTER_REVIEW"] as const;
export type SonicF11ResilienceKind=typeof SONIC_F11_RESILIENCE_KINDS[number];
export type SonicF11ResilienceResult=
 | {ok:false;code:"F11_RESILIENCE_INPUT_INVALID"|"F11_RESILIENCE_OWNER_REQUIRED"|
   "F11_RESILIENCE_SCOPE_MISMATCH"|"F11_RESILIENCE_STALE"|"F11_RESILIENCE_EVIDENCE_INVALID"}
 | {ok:true;value:{
   state:"F11_UNPERSISTED_OWNER_REVIEW";kind:SonicF11ResilienceKind;
   workspaceId:string;branchId:string;sourceId:string;sourceVersion:number;
   decision:"REVIEW_RECOMMENDED"|"NOT_DUE";proposedTask:"REVIEW_PROVIDER_DEGRADATION"|"REVIEW_OUTBOX_DEAD_LETTER"|null;
   dueAt:string;fingerprint:string|null;sourceAuthenticationRequired:true;
   humanApprovalRequired:true;saved:false;scheduled:false;executed:false;
   providerCalled:false;customerMessageSent:false;financialMutation:false;
   bookingChanged:false;recordChanged:false;
 }};
const fail=(code:Extract<SonicF11ResilienceResult,{ok:false}>["code"]):SonicF11ResilienceResult=>({ok:false,code});
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
const extras:Record<SonicF11ResilienceKind,readonly string[]>={
 PROVIDER_HEALTH_REVIEW:["status","providerCode","failedChecks","lastCheckAt"],
 OUTBOX_DEAD_LETTER_REVIEW:["status","deliveryState","retryCount","deadLetterAt"],
};
const tasks:Record<SonicF11ResilienceKind,NonNullable<Extract<SonicF11ResilienceResult,{ok:true}>["value"]["proposedTask"]>>={
 PROVIDER_HEALTH_REVIEW:"REVIEW_PROVIDER_DEGRADATION",
 OUTBOX_DEAD_LETTER_REVIEW:"REVIEW_OUTBOX_DEAD_LETTER"
};
function ownedKind(v:unknown):SonicF11ResilienceKind|null{
 try {
  if(!v||typeof v!=="object"||Array.isArray(v)||Object.getPrototypeOf(v)!==Object.prototype)return null;
  const d=Object.getOwnPropertyDescriptor(v,"kind");
  return d&&Object.hasOwn(d,"value")&&typeof d.value==="string"&&
   Object.hasOwn(extras,d.value)?d.value as SonicF11ResilienceKind:null;
 } catch {return null;}
}
export function planSonicF11Resilience(input:unknown):SonicF11ResilienceResult{
 try {
  if(!exact(input,["actor","workspaceId","branchId","asOf","expectedVersion","record"])||
   !exact(input.actor,["workspaceId","role"])||!id(input.workspaceId)||!id(input.branchId)||
   !id(input.actor.workspaceId)||!vers(input.expectedVersion))
   return fail("F11_RESILIENCE_INPUT_INVALID");
  const now=trustedQuoteInstant(input.asOf);
  if(now===null)return fail("F11_RESILIENCE_INPUT_INVALID");
  if(input.actor.role!=="OWNER"||input.actor.workspaceId!==input.workspaceId)
   return fail("F11_RESILIENCE_OWNER_REQUIRED");
  const r=input.record,kind=ownedKind(r);
  if(!kind||!exact(r,[...common,...extras[kind]])||!id(r.workspaceId)||!id(r.branchId)||
   !id(r.sourceId)||!vers(r.sourceVersion))return fail("F11_RESILIENCE_INPUT_INVALID");
  if(r.workspaceId!==input.workspaceId||r.branchId!==input.branchId)
   return fail("F11_RESILIENCE_SCOPE_MISMATCH");
  if(r.sourceVersion!==input.expectedVersion)return fail("F11_RESILIENCE_STALE");
  let due:number|null=null;
  if(kind==="PROVIDER_HEALTH_REVIEW"){
   if(r.status!=="DEGRADED"||(typeof r.providerCode!=="string"||!["AI_GATEWAY","EMAIL","WHATSAPP","CALENDAR"].includes(r.providerCode))||
    typeof r.failedChecks!=="number"||!Number.isSafeInteger(r.failedChecks)||
    r.failedChecks<3||r.failedChecks>100||trustedQuoteInstant(r.lastCheckAt)===null||
    trustedQuoteInstant(r.lastCheckAt)!>now)return fail("F11_RESILIENCE_EVIDENCE_INVALID");
   due=trustedQuoteInstant(r.lastCheckAt)!+5*60_000;
  }else{
   if(r.status!=="DEAD_LETTER"||r.deliveryState!=="UNDELIVERED"||
    typeof r.retryCount!=="number"||!Number.isSafeInteger(r.retryCount)||
    r.retryCount<3||r.retryCount>30||trustedQuoteInstant(r.deadLetterAt)===null||
    trustedQuoteInstant(r.deadLetterAt)!>now)return fail("F11_RESILIENCE_EVIDENCE_INVALID");
   due=trustedQuoteInstant(r.deadLetterAt);
  }
  if(due===null||!Number.isFinite(due))return fail("F11_RESILIENCE_EVIDENCE_INVALID");
  const pending=due>now;
  const fingerprint=pending?null:createHash("sha256").update(JSON.stringify([
   "F11_RESILIENCE_UNPERSISTED_NOT_EXECUTION",kind,r.workspaceId,r.branchId,r.sourceId,
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
 } catch {return fail("F11_RESILIENCE_INPUT_INVALID");}
}
