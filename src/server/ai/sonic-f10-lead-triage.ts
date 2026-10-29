import {createHash} from "node:crypto";
import {trustedQuoteInstant} from "@/features/operations/quote-validity-clock";

/** F10: two new business-policy decisions; not a database writer, spam
 * suppression service, customer profile merger or branch assignment. */
export type SonicF10LeadReviewKind="SPAM_LEAD_REVIEW"|"PROPERTY_BRANCH_ROUTING";
export type SonicF10LeadReviewResult=
 | {ok:false;code:"F10_LEAD_INPUT_INVALID"|"F10_LEAD_OWNER_REQUIRED"|
   "F10_LEAD_TENANT_MISMATCH"|"F10_LEAD_SOURCE_STALE"|
   "F10_LEAD_EVIDENCE_INVALID"}
 | {ok:true;value:{
   state:"F10_UNPERSISTED_INTERNAL_LEAD_REVIEW";kind:SonicF10LeadReviewKind;
   workspaceId:string;branchId:string;sourceId:string;sourceVersion:number;
   review:"REVIEW_RECOMMENDED"|"NO_REVIEW_SIGNAL";
   proposedCode:"REVIEW_SUSPECTED_SPAM"|"REVIEW_PROPERTY_BRANCH_ROUTE"|null;
   suggestedBranchId:string|null;fingerprint:string|null;
   ownerApprovalRequired:true;sourceAuthenticationRequired:true;
   created:false;executed:false;leadBlocked:false;leadMerged:false;
   branchReassigned:false;providerCalled:false;customerContacted:false;
 }};
const fail=(code:Extract<SonicF10LeadReviewResult,{ok:false}>["code"]):SonicF10LeadReviewResult=>({ok:false,code});
const key=(v:unknown):v is string=>typeof v==="string"&&
 /^[A-Za-z0-9:_-]{3,128}$/.test(v);
const version=(v:unknown)=>typeof v==="number"&&Number.isSafeInteger(v)&&
 v>=1&&v<=2147483647;
function exact(v:unknown,keys:readonly string[]):v is Record<string,unknown>{
 try{
  if(!v||typeof v!=="object"||Array.isArray(v)||
    Object.getPrototypeOf(v)!==Object.prototype)return false;
  const names=Reflect.ownKeys(v);
  return names.length===keys.length&&names.every(n=>
   typeof n==="string"&&keys.includes(n))&&
   keys.every(n=>Object.hasOwn(v,n))&&
   Object.values(Object.getOwnPropertyDescriptors(v)).every(d=>Object.hasOwn(d,"value"));
 }catch{return false;}
}
function safeKind(v:unknown):unknown{
 try{
  if(!v||typeof v!=="object"||Object.getPrototypeOf(v)!==Object.prototype)return null;
  const d=Object.getOwnPropertyDescriptor(v,"kind");
  return d&&Object.hasOwn(d,"value")?d.value:null;
 }catch{return null;}
}
const base=["kind","workspaceId","branchId","sourceId","sourceVersion"] as const;
export function reviewSonicF10LeadPolicy(input:unknown):SonicF10LeadReviewResult{
 if(!exact(input,["actor","workspaceId","branchId","asOf","expectedVersion","record"])||
   !exact(input.actor,["workspaceId","role"])||
   !key(input.workspaceId)||!key(input.branchId)||!key(input.actor.workspaceId)||
   !version(input.expectedVersion)||trustedQuoteInstant(input.asOf)===null)
  return fail("F10_LEAD_INPUT_INVALID");
 if(input.actor.role!=="OWNER"||input.actor.workspaceId!==input.workspaceId)
  return fail("F10_LEAD_OWNER_REQUIRED");
 const r=input.record,kind=safeKind(r);
 if(kind!=="SPAM_LEAD_REVIEW"&&kind!=="PROPERTY_BRANCH_ROUTING")
  return fail("F10_LEAD_INPUT_INVALID");
 const specific=kind==="SPAM_LEAD_REVIEW"?
  ["status","riskScore","signal","signalAt"] :
  ["status","propertyZoneCode","candidateBranchId","savedMappedBranchId","coverage"];
 if(!exact(r,[...base,...specific])||
   !key(r.workspaceId)||!key(r.branchId)||!key(r.sourceId)||
   !version(r.sourceVersion))return fail("F10_LEAD_INPUT_INVALID");
 if(r.workspaceId!==input.workspaceId||r.branchId!==input.branchId)
  return fail("F10_LEAD_TENANT_MISMATCH");
 if(r.sourceVersion!==input.expectedVersion)return fail("F10_LEAD_SOURCE_STALE");
 let review=false,assigned:string|null=null;
 if(kind==="SPAM_LEAD_REVIEW"){
  if(r.status!=="OPEN"||r.signal!=="PERSISTED_ABUSE_RULE_SIGNAL"||
    typeof r.riskScore!=="number"||!Number.isSafeInteger(r.riskScore)||
    r.riskScore<0||r.riskScore>100||
    trustedQuoteInstant(r.signalAt)===null||
    trustedQuoteInstant(r.signalAt)!>trustedQuoteInstant(input.asOf)!)
   return fail("F10_LEAD_EVIDENCE_INVALID");
  review=r.riskScore>=80;
 }else{
  if(r.status!=="PENDING_ROUTE"||!key(r.propertyZoneCode)||
    !key(r.candidateBranchId)||!key(r.savedMappedBranchId)||
    typeof r.coverage!=="boolean")
   return fail("F10_LEAD_EVIDENCE_INVALID");
  review=r.coverage&&r.candidateBranchId===r.savedMappedBranchId;
  if(review)assigned=r.candidateBranchId as string;
 }
 const fingerprint=review?createHash("sha256").update(JSON.stringify([
  "F10_LEAD_HUMAN_REVIEW_NOT_EXECUTION",kind,r.workspaceId,r.branchId,
  r.sourceId,r.sourceVersion,...specific.map(k=>r[k]),
 ])).digest("hex"):null;
 return {ok:true,value:{
  state:"F10_UNPERSISTED_INTERNAL_LEAD_REVIEW",kind,
  workspaceId:input.workspaceId as string,branchId:input.branchId as string,
  sourceId:r.sourceId as string,sourceVersion:r.sourceVersion as number,
  review:review?"REVIEW_RECOMMENDED":"NO_REVIEW_SIGNAL",
  proposedCode:review?(kind==="SPAM_LEAD_REVIEW"?"REVIEW_SUSPECTED_SPAM":
   "REVIEW_PROPERTY_BRANCH_ROUTE"):null,
  suggestedBranchId:assigned,fingerprint,
  ownerApprovalRequired:true,sourceAuthenticationRequired:true,
  created:false,executed:false,leadBlocked:false,leadMerged:false,
  branchReassigned:false,providerCalled:false,customerContacted:false,
 }};
}
