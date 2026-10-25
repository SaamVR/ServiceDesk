import {loadOperationalStaffSnapshot,type OperationalStaffSnapshot} from "@/features/operations/operational-product-runtime";
import {trustedQuoteInstant} from "@/features/operations/quote-validity-clock";

type Loader=typeof loadOperationalStaffSnapshot;
export interface F04RetentionDependencies{loadSnapshot?:Loader;now?:()=>number;signal?:AbortSignal}
export type F04RetentionResult=
 | {ok:false;code:"F04_RETENTION_INPUT_INVALID"|"F04_RETENTION_OWNER_REQUIRED"|
   "F04_RETENTION_SOURCE_UNAVAILABLE"|"F04_RETENTION_SOURCE_INCOMPLETE"|
   "F04_RETENTION_SOURCE_CHANGED"|"F04_RETENTION_CANCELLED"}
 | {ok:true;value:{
   state:"SAVED_HISTORY_RETENTION_REVIEW_ONLY";
   source:"DOUBLE_READ_SAVED_VISITS_REQUESTS_AND_EXPLICIT_OPT_IN";
   workspaceId:string;sourceClock:string;
   candidates:Array<{
     customerId:string;channel:"EMAIL"|"WHATSAPP";
     kind:"REPEAT_CLEANING_REVIEW"|"SERVICE_GAP_REVIEW_NOT_CHURN_PROOF";
     lastCompletedVisitId:string;lastScheduledStartAt:string;
     savedCompletedVisitCount:number;customerConsentRecordedAt:string;
     retentionControlVersion:number;
     manualContactAndPurposeRevalidationRequired:true;
     customerContactSent:false;outreachScheduled:false;
   }>;
   sourceCompletenessUnverified:true;churnProven:false;
   staffApprovalRequired:true;noAutonomousSend:true;
   paymentChanged:false;modelInvoked:false;businessStateMutated:false;
 }};
const fail=(code:Extract<F04RetentionResult,{ok:false}>["code"]):F04RetentionResult=>({ok:false,code});
const id=(v:unknown):v is string=>typeof v==="string"&&/^[A-Za-z0-9:_-]{3,128}$/.test(v);
const time=(v:unknown)=>trustedQuoteInstant(v);
const validArray=(v:unknown,cap:number):v is Record<string,unknown>[]=>{
 if(!Array.isArray(v)||Object.getPrototypeOf(v)!==Array.prototype||
    v.length>=cap||Reflect.ownKeys(v).length!==v.length+1)return false;
 return v.every(x=>{if(!x||typeof x!=="object"||Array.isArray(x)||
   Object.getPrototypeOf(x)!==Object.prototype)return false;
   const d=Object.getOwnPropertyDescriptors(x);
   return Reflect.ownKeys(x).length===Object.keys(x).length&&
     Object.values(d).every(o=>Object.hasOwn(o,"value"));
 });
};
function authorized(s:OperationalStaffSnapshot,slug:string,now:number):boolean{
 const at=time(s.loadedAt);
 return s.workspace?.slug===slug&&id(s.workspace.id)&&s.actor?.role==="OWNER"&&
   s.actor.workspaceId===s.workspace.id&&id(s.actor.userId)&&
   s.branchScope?.mode==="ALL"&&at!==null&&Number.isFinite(now)&&
   at>=now-300_000&&at<=now+60_000;
}
type Candidate=Extract<F04RetentionResult,{ok:true}>["value"]["candidates"][number];
type SnapshotProof={fingerprint:string;candidates:Candidate[]};
function savedProof(s:OperationalStaffSnapshot):SnapshotProof|null{
 if(s.retentionAvailable!==true||!validArray(s.customers,200)||
    !validArray(s.requests,300)||!validArray(s.visits,300)||
    !validArray(s.recurrenceRules,100)||
    !validArray(s.communicationConsents,2000)||
    !validArray(s.retentionControls,1000))return null;
 const work=s.workspace.id,at=time(s.loadedAt)!;
 const customerIds=new Set<string>(),requests=new Map<string,OperationalStaffSnapshot["requests"][number]>();
 const branchIds=new Set(s.branchScope!.branches.map(b=>b.id));
 if(!branchIds.size||branchIds.size!==s.branchScope!.branches.length)return null;
 for(const c of s.customers){
  if(!id(c.id)||customerIds.has(c.id))return null;
  customerIds.add(c.id);
 }
 for(const req of s.requests){
  if(!id(req.id)||requests.has(req.id)||!id(req.branchId)||!branchIds.has(req.branchId)||
     (req.customerId!==undefined&&!customerIds.has(req.customerId))||
     !Number.isSafeInteger(req.version)||req.version<1)return null;
  requests.set(req.id,req);
 }
 const byCustomer=new Map<string,Array<{id:string;startAt:string;version:number;status:string}>>();
 const scheduled=new Set<string>(),allVisits=new Set<string>();
 for(const v of s.visits){
  const parent=requests.get(v.requestId),t=time(v.startAt);
  if(!id(v.id)||allVisits.has(v.id)||v.workspaceId!==work||
     !parent||parent.branchId!==v.branchId||!parent.customerId||
     !["AWAITING_PAYMENT","CONFIRMED","ASSIGNED","EN_ROUTE","IN_PROGRESS",
      "PENDING_REVIEW","COMPLETED","CANCELLED","PAYMENT_REVIEW"].includes(v.status)||
     !Number.isSafeInteger(v.version)||v.version<1||t===null)return null;
  allVisits.add(v.id);
  if(["CONFIRMED","ASSIGNED","EN_ROUTE","IN_PROGRESS","PENDING_REVIEW"].includes(v.status))
    scheduled.add(parent.customerId);
  if(v.status==="COMPLETED"&&t<=at){
    const previous=byCustomer.get(parent.customerId)??[];
    previous.push({id:v.id,startAt:v.startAt,version:v.version,status:v.status});
    byCustomer.set(parent.customerId,previous);
  }
 }
 const recurring=new Set<string>(),recurIds=new Set<string>();
 for(const r of s.recurrenceRules){
  const parent=requests.get(r.requestId);
  if(!id(r.id)||recurIds.has(r.id)||!parent||!parent.customerId||
     parent.branchId!==r.branchId||!Number.isSafeInteger(r.version)||r.version<1||
     !["ACTIVE","PAUSED","COMPLETED"].includes(r.status))return null;
  recurIds.add(r.id);
  if(r.status==="ACTIVE")recurring.add(parent.customerId);
 }
 const consentKey=new Set<string>(),controlsKey=new Set<string>();
 for(const c of s.communicationConsents){
  const key=c.customerId+":"+c.channel;
  if(!customerIds.has(c.customerId)||!["EMAIL","WHATSAPP"].includes(c.channel)||
     consentKey.has(key)||time(c.recordedAt)===null||
     time(c.recordedAt)!>at)return null;
  consentKey.add(key);
 }
 for(const c of s.retentionControls){
  const key=c.customerId+":"+c.channel;
  if(!customerIds.has(c.customerId)||!["EMAIL","WHATSAPP"].includes(c.channel)||
     controlsKey.has(key)||!["ACTIVE","PAUSED","SUPPRESSED"].includes(c.status)||
     !Number.isSafeInteger(c.version)||c.version<1)return null;
  controlsKey.add(key);
 }
 const candidates:Candidate[]=[];
 for(const [customerId,completed] of byCustomer){
  if(scheduled.has(customerId)||recurring.has(customerId))continue;
  const history=[...completed].sort((a,b)=>time(b.startAt)!-time(a.startAt)!||a.id.localeCompare(b.id));
  const latest=history[0],ageDays=(at-time(latest.startAt)!)/86_400_000;
  // The persisted visit start is NOT a completion timestamp or proof of churn.
  // A very recent/very old record alone does not justify speculative outreach.
  if(ageDays<14||ageDays>180)continue;
  const kind:Candidate["kind"]=ageDays>=60?
    "SERVICE_GAP_REVIEW_NOT_CHURN_PROOF":"REPEAT_CLEANING_REVIEW";
  for(const channel of ["EMAIL","WHATSAPP"] as const){
   const c=s.communicationConsents.find(x=>x.customerId===customerId&&x.channel===channel);
   const control=s.retentionControls.find(x=>x.customerId===customerId&&x.channel===channel);
   if(!c||c.status!=="GRANTED"||
      !["FOLLOW_UP","RETENTION","SERVICE_FOLLOW_UP"].includes(c.purpose)||
      !control||control.status!=="ACTIVE"||
      (control.untilAt!==undefined&&time(control.untilAt)===null))continue;
   candidates.push({
    customerId,channel,kind,lastCompletedVisitId:latest.id,
    lastScheduledStartAt:latest.startAt,savedCompletedVisitCount:history.length,
    customerConsentRecordedAt:c.recordedAt,retentionControlVersion:control.version,
    manualContactAndPurposeRevalidationRequired:true,
    customerContactSent:false,outreachScheduled:false,
   });
  }
 }
 candidates.sort((a,b)=>a.customerId.localeCompare(b.customerId)||a.channel.localeCompare(b.channel));
 const tuples=(rows:readonly object[],fields:string[])=>rows.map(r=>
   fields.map(k=>(r as Record<string,unknown>)[k]??null))
   .sort((a,b)=>String(a[0]).localeCompare(String(b[0])));
 // Changing the preference timestamp, control version, completed record or
 // future appointment invalidates BOTH reviewed sources, even when the same
 // number of candidates would result.
 const fingerprint=JSON.stringify({
  customers:tuples(s.customers,["id"]),
  requests:tuples(s.requests,["id","branchId","customerId","version","status","propertyId"]),
  visits:tuples(s.visits,["id","requestId","branchId","status","version","startAt"]),
  recurrence:tuples(s.recurrenceRules,["id","branchId","requestId","status","version","nextOccurrenceOn"]),
  consent:tuples(s.communicationConsents,["customerId","channel","status","purpose","recordedAt"]),
  control:tuples(s.retentionControls,["customerId","channel","status","version","untilAt"]),
 });
 return {fingerprint,candidates};
}
/** Saved-history internal outreach REVIEW only. Opt-in and suppression require
 * another authoritative check on action, including identity and quiet hours.
 * No contact address, delivery intent, model or provider is constructed.
 */
export async function proposeF04SavedRetentionReview(
 slug:string,deps:F04RetentionDependencies={},
):Promise<F04RetentionResult>{
 if(typeof slug!=="string"||slug.length<3||slug.length>40||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
   return fail("F04_RETENTION_INPUT_INVALID");
 if(deps.signal?.aborted)return fail("F04_RETENTION_CANCELLED");
 const load=deps.loadSnapshot??loadOperationalStaffSnapshot,now=deps.now??Date.now;
 let a:Awaited<ReturnType<Loader>>;
 try{a=await load(slug);}catch{return fail("F04_RETENTION_SOURCE_UNAVAILABLE");}
 if(!a.ok||!authorized(a.value,slug,now()))return fail("F04_RETENTION_OWNER_REQUIRED");
 const first=savedProof(a.value);
 if(!first)return fail("F04_RETENTION_SOURCE_INCOMPLETE");
 if(deps.signal?.aborted)return fail("F04_RETENTION_CANCELLED");
 let b:Awaited<ReturnType<Loader>>;
 try{b=await load(slug);}catch{return fail("F04_RETENTION_SOURCE_UNAVAILABLE");}
 if(!b.ok||!authorized(b.value,slug,now())||
   b.value.workspace.id!==a.value.workspace.id||b.value.actor.userId!==a.value.actor.userId)
   return fail("F04_RETENTION_SOURCE_CHANGED");
 const latest=savedProof(b.value);
 if(!latest||latest.fingerprint!==first.fingerprint)
   return fail("F04_RETENTION_SOURCE_CHANGED");
 if(deps.signal?.aborted)return fail("F04_RETENTION_CANCELLED");
 return {ok:true,value:{
  state:"SAVED_HISTORY_RETENTION_REVIEW_ONLY",
  source:"DOUBLE_READ_SAVED_VISITS_REQUESTS_AND_EXPLICIT_OPT_IN",
  workspaceId:b.value.workspace.id,sourceClock:b.value.loadedAt,candidates:latest.candidates,
  sourceCompletenessUnverified:true,churnProven:false,
  staffApprovalRequired:true,noAutonomousSend:true,
  paymentChanged:false,modelInvoked:false,businessStateMutated:false,
 }};
}
