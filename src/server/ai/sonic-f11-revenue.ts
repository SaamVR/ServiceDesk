import {createHash} from "node:crypto";
import {trustedQuoteInstant} from "@/features/operations/quote-validity-clock";

/** F11 revenue review proposals from caller-claimed saved projections.
 * Never persist, schedule, notify, charge, dispatch or claim a provider receipt. */
export const SONIC_F11_REVENUE_KINDS=["QUOTE_EXPIRY_REVIEW","INVOICE_OVERDUE_REVIEW"] as const;
export type SonicF11RevenueKind=typeof SONIC_F11_REVENUE_KINDS[number];
export type SonicF11RevenueResult=
 | {ok:false;code:"F11_REVENUE_INPUT_INVALID"|"F11_REVENUE_OWNER_REQUIRED"|
   "F11_REVENUE_SCOPE_MISMATCH"|"F11_REVENUE_STALE"|"F11_REVENUE_EVIDENCE_INVALID"}
 | {ok:true;value:{
   state:"F11_UNPERSISTED_OWNER_REVIEW";kind:SonicF11RevenueKind;
   workspaceId:string;branchId:string;sourceId:string;sourceVersion:number;
   decision:"REVIEW_RECOMMENDED"|"NOT_DUE";proposedTask:"REVIEW_EXPIRED_QUOTE"|"REVIEW_OVERDUE_INVOICE"|null;
   dueAt:string;fingerprint:string|null;sourceAuthenticationRequired:true;
   humanApprovalRequired:true;saved:false;scheduled:false;executed:false;
   providerCalled:false;customerMessageSent:false;financialMutation:false;
   bookingChanged:false;recordChanged:false;
 }};
const fail=(code:Extract<SonicF11RevenueResult,{ok:false}>["code"]):SonicF11RevenueResult=>({ok:false,code});
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
const extras:Record<SonicF11RevenueKind,readonly string[]>={
 QUOTE_EXPIRY_REVIEW:["status","expiresAt","acceptedAt"],
 INVOICE_OVERDUE_REVIEW:["status","dueAt","outstandingMinorUnits","currency","paidAt"],
};
const tasks:Record<SonicF11RevenueKind,NonNullable<Extract<SonicF11RevenueResult,{ok:true}>["value"]["proposedTask"]>>={
 QUOTE_EXPIRY_REVIEW:"REVIEW_EXPIRED_QUOTE",
 INVOICE_OVERDUE_REVIEW:"REVIEW_OVERDUE_INVOICE"
};
function ownedKind(v:unknown):SonicF11RevenueKind|null{
 try {
  if(!v||typeof v!=="object"||Array.isArray(v)||Object.getPrototypeOf(v)!==Object.prototype)return null;
  const d=Object.getOwnPropertyDescriptor(v,"kind");
  return d&&Object.hasOwn(d,"value")&&typeof d.value==="string"&&
   Object.hasOwn(extras,d.value)?d.value as SonicF11RevenueKind:null;
 } catch {return null;}
}
export function planSonicF11Revenue(input:unknown):SonicF11RevenueResult{
 try {
  if(!exact(input,["actor","workspaceId","branchId","asOf","expectedVersion","record"])||
   !exact(input.actor,["workspaceId","role"])||!id(input.workspaceId)||!id(input.branchId)||
   !id(input.actor.workspaceId)||!vers(input.expectedVersion))
   return fail("F11_REVENUE_INPUT_INVALID");
  const now=trustedQuoteInstant(input.asOf);
  if(now===null)return fail("F11_REVENUE_INPUT_INVALID");
  if(input.actor.role!=="OWNER"||input.actor.workspaceId!==input.workspaceId)
   return fail("F11_REVENUE_OWNER_REQUIRED");
  const r=input.record,kind=ownedKind(r);
  if(!kind||!exact(r,[...common,...extras[kind]])||!id(r.workspaceId)||!id(r.branchId)||
   !id(r.sourceId)||!vers(r.sourceVersion))return fail("F11_REVENUE_INPUT_INVALID");
  if(r.workspaceId!==input.workspaceId||r.branchId!==input.branchId)
   return fail("F11_REVENUE_SCOPE_MISMATCH");
  if(r.sourceVersion!==input.expectedVersion)return fail("F11_REVENUE_STALE");
  let due:number|null=null;
  if(kind==="QUOTE_EXPIRY_REVIEW"){
   if(r.status!=="SENT"||r.acceptedAt!==null||trustedQuoteInstant(r.expiresAt)===null)
    return fail("F11_REVENUE_EVIDENCE_INVALID");
   due=trustedQuoteInstant(r.expiresAt);
  }else{
   if(r.status!=="ISSUED"||r.paidAt!==null||(typeof r.currency!=="string"||!["BDT","USD","GBP","EUR"].includes(r.currency))||
    typeof r.outstandingMinorUnits!=="number"||!Number.isSafeInteger(r.outstandingMinorUnits)||
    r.outstandingMinorUnits<1||r.outstandingMinorUnits>100_000_000_00||
    trustedQuoteInstant(r.dueAt)===null)return fail("F11_REVENUE_EVIDENCE_INVALID");
   due=trustedQuoteInstant(r.dueAt);
  }
  if(due===null||due>now+365*86400_000)return fail("F11_REVENUE_EVIDENCE_INVALID");
  if(due===null||!Number.isFinite(due))return fail("F11_REVENUE_EVIDENCE_INVALID");
  const pending=due>now;
  const fingerprint=pending?null:createHash("sha256").update(JSON.stringify([
   "F11_REVENUE_UNPERSISTED_NOT_EXECUTION",kind,r.workspaceId,r.branchId,r.sourceId,
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
 } catch {return fail("F11_REVENUE_INPUT_INVALID");}
}
