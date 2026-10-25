import {createHash} from "node:crypto";
import {trustedQuoteInstant} from "@/features/operations/quote-validity-clock";

/** F09 first four high-value SONIC automations: deterministic internal
 * review recommendations only. Real event ingress, journal, jobs, publishing
 * and provider outbox belong to Production's approved implementation. */
export const SONIC_F09_RECIPE_KINDS=[
 "DUPLICATE_LEAD_REVIEW","LEAD_SLA_ESCALATION",
 "QUOTE_OPEN_FOLLOW_UP","CREW_CHECKIN_OVERDUE",
] as const;
export type SonicF09RecipeKind=typeof SONIC_F09_RECIPE_KINDS[number];
export type SonicF09RecipeResult=
 | {ok:false;code:"F09_RECIPE_INVALID"|"F09_RECIPE_OWNER_REQUIRED"|
   "F09_RECIPE_SCOPE_MISMATCH"|"F09_RECIPE_VERSION_STALE"|
   "F09_RECIPE_EVIDENCE_INVALID"}
 | {ok:true;value:{
   state:"F09_OWNER_INTERNAL_REVIEW_PLAN_UNPERSISTED";kind:SonicF09RecipeKind;
   workspaceId:string;branchId:string;sourceId:string;sourceVersion:number;
   outcome:"REVIEW_SUGGESTED"|"NOT_DUE";
   proposedInternalTask:"REVIEW_POSSIBLE_DUPLICATE"|"REVIEW_UNANSWERED_LEAD"|
    "REVIEW_OPENED_QUOTE"|"REVIEW_CREW_CHECKIN"|null;
   dueAt:string|null;fingerprint:string|null;
   sourceReauthenticationRequired:true;ownerApprovalRequired:true;
   saved:false;scheduled:false;executed:false;merged:false;customerContacted:false;
   providerCalled:false;crewAssignmentChanged:false;moneyChanged:false;
 }};
const fail=(code:Extract<SonicF09RecipeResult,{ok:false}>["code"]):SonicF09RecipeResult=>({ok:false,code});
function exact(v:unknown,keys:readonly string[]):v is Record<string,unknown>{
 try{
  if(!v||typeof v!=="object"||Array.isArray(v)||
   Object.getPrototypeOf(v)!==Object.prototype)return false;
  const entries=Reflect.ownKeys(v);
  return entries.length===keys.length&&entries.every(k=>
   typeof k==="string"&&keys.includes(k))&&
   keys.every(k=>Object.hasOwn(v,k))&&
   Object.values(Object.getOwnPropertyDescriptors(v)).every(d=>Object.hasOwn(d,"value"));
 }catch{return false;}
}
const id=(v:unknown):v is string=>typeof v==="string"&&
 /^[A-Za-z0-9:_-]{3,128}$/.test(v);
const vers=(v:unknown):v is number=>typeof v==="number"&&
 Number.isSafeInteger(v)&&v>0&&v<=2147483647;
const common=["kind","workspaceId","branchId","sourceId","sourceVersion"] as const;
const required:Record<SonicF09RecipeKind,readonly string[]>={
 DUPLICATE_LEAD_REVIEW:["status","matchedLeadId","matchEvidence"],
 LEAD_SLA_ESCALATION:["status","receivedAt","thresholdMinutes"],
 QUOTE_OPEN_FOLLOW_UP:["status","openedAt","lastReplyAt","waitHours"],
 CREW_CHECKIN_OVERDUE:["status","scheduledStartAt","checkInAt","graceMinutes"],
};
const task:Record<SonicF09RecipeKind,NonNullable<Extract<SonicF09RecipeResult,{ok:true}>["value"]["proposedInternalTask"]>>={
 DUPLICATE_LEAD_REVIEW:"REVIEW_POSSIBLE_DUPLICATE",
 LEAD_SLA_ESCALATION:"REVIEW_UNANSWERED_LEAD",
 QUOTE_OPEN_FOLLOW_UP:"REVIEW_OPENED_QUOTE",
 CREW_CHECKIN_OVERDUE:"REVIEW_CREW_CHECKIN",
};
/** Always evaluate against a saved projection only after independent tenant
 * authentication at the caller. Does not write a task or execute a rule. */
export function planSonicF09OperationalRecipe(input:unknown):SonicF09RecipeResult{
 if(!exact(input,["actor","workspaceId","branchId","asOf","expectedVersion","record"])||
  !exact(input.actor,["workspaceId","role"])||
  !id(input.workspaceId)||!id(input.branchId)||!id(input.actor.workspaceId)||
  !vers(input.expectedVersion)||trustedQuoteInstant(input.asOf)===null)
  return fail("F09_RECIPE_INVALID");
 if(input.actor.role!=="OWNER"||input.actor.workspaceId!==input.workspaceId)
  return fail("F09_RECIPE_OWNER_REQUIRED");
 const r=input.record;
 if(!r||typeof r!=="object"||Array.isArray(r))return fail("F09_RECIPE_INVALID");
 const k=(r as Record<string,unknown>).kind;
 if(typeof k!=="string"||!Object.hasOwn(required,k))return fail("F09_RECIPE_INVALID");
 const kind=k as SonicF09RecipeKind;
 if(!exact(r,[...common,...required[kind]])||
   !id(r.workspaceId)||!id(r.branchId)||!id(r.sourceId)||!vers(r.sourceVersion))
   return fail("F09_RECIPE_INVALID");
 if(input.workspaceId!==r.workspaceId||input.branchId!==r.branchId)
  return fail("F09_RECIPE_SCOPE_MISMATCH");
 if(input.expectedVersion!==r.sourceVersion)return fail("F09_RECIPE_VERSION_STALE");
 const now=trustedQuoteInstant(input.asOf)!;
 let due:number|null=null;
 if(kind==="DUPLICATE_LEAD_REVIEW"){
  if(r.status!=="OPEN"||!id(r.matchedLeadId)||
    r.matchedLeadId===r.sourceId||r.matchEvidence!=="SAVED_CONTACT_HASH_MATCH")
   return fail("F09_RECIPE_EVIDENCE_INVALID");
  due=now;
 }else if(kind==="LEAD_SLA_ESCALATION"){
  if(r.status!=="UNANSWERED"||![15,30,60].includes(Number(r.thresholdMinutes))||
   trustedQuoteInstant(r.receivedAt)===null)
   return fail("F09_RECIPE_EVIDENCE_INVALID");
  due=trustedQuoteInstant(r.receivedAt)!+Number(r.thresholdMinutes)*60_000;
 }else if(kind==="QUOTE_OPEN_FOLLOW_UP"){
  if(r.status!=="SENT"||r.lastReplyAt!==null||
    ![24,48].includes(Number(r.waitHours))||trustedQuoteInstant(r.openedAt)===null)
   return fail("F09_RECIPE_EVIDENCE_INVALID");
  due=trustedQuoteInstant(r.openedAt)!+Number(r.waitHours)*3600_000;
 }else{
  if(r.status!=="ASSIGNED"||r.checkInAt!==null||
   ![15,30].includes(Number(r.graceMinutes))||
   trustedQuoteInstant(r.scheduledStartAt)===null)
   return fail("F09_RECIPE_EVIDENCE_INVALID");
  due=trustedQuoteInstant(r.scheduledStartAt)!+Number(r.graceMinutes)*60_000;
 }
 if(due===null||!Number.isFinite(due))return fail("F09_RECIPE_EVIDENCE_INVALID");
 const pending=due>now;
 const fingerprint=pending?null:createHash("sha256").update(JSON.stringify([
  "F09_OWNER_REVIEW_ONLY",kind,r.workspaceId,r.branchId,
  r.sourceId,r.sourceVersion,due,
 ])).digest("hex");
 return {ok:true,value:{
  state:"F09_OWNER_INTERNAL_REVIEW_PLAN_UNPERSISTED",kind,
  workspaceId:input.workspaceId as string,branchId:input.branchId as string,
  sourceId:r.sourceId as string,sourceVersion:r.sourceVersion as number,
  outcome:pending?"NOT_DUE":"REVIEW_SUGGESTED",
  proposedInternalTask:pending?null:task[kind],
  dueAt:new Date(due).toISOString(),fingerprint,
  sourceReauthenticationRequired:true,ownerApprovalRequired:true,
  saved:false,scheduled:false,executed:false,merged:false,
  customerContacted:false,providerCalled:false,
  crewAssignmentChanged:false,moneyChanged:false,
 }};
}
