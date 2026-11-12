import {createHash} from "node:crypto";
import {loadOperationalStaffSnapshot,type OperationalStaffSnapshot} from "@/features/operations/operational-product-runtime";
import {trustedQuoteInstant} from "@/features/operations/quote-validity-clock";

type Loader=typeof loadOperationalStaffSnapshot;
export interface F07WorkflowCriticDeps{loadSnapshot?:Loader;now?:()=>number;signal?:AbortSignal}
export type F07WorkflowWarning="WORKFLOW_ACTION_FAILED"|"WORKFLOW_SUCCESS_CONTRADICTED"|
 "PROVIDER_DELIVERY_UNVERIFIED"|"PROVIDER_CODE_UNRECOGNIZED"|
 "REPLAY_NEEDS_DEDUP_REVIEW"|"EXECUTION_PARTIAL_FAILURE";
export type F07WorkflowCriticResult=
 | {ok:false;code:"F07_WORKFLOW_INVALID"|"F07_WORKFLOW_OWNER_REQUIRED"|
   "F07_WORKFLOW_SOURCE_UNAVAILABLE"|"F07_WORKFLOW_SOURCE_UNVERIFIED"|
   "F07_WORKFLOW_SOURCE_CHANGED"|"F07_WORKFLOW_CANCELLED"}
 | {ok:true;value:{
   state:"F07_SAVED_WORKFLOW_CRITIC_OWNER_REVIEW_ONLY";
   source:"DOUBLE_READ_SCOPED_WORKFLOW_AND_ACTION_RECORDS";
   workspaceId:string;readAt:string;inspectedExecutions:number;inspectedActions:number;
   evidenceDigest:string;observedHistoricalCompletenessUnverified:true;
   warnings:Array<{executionId:string;actionId:string;kind:F07WorkflowWarning;
     actionType:"CREATE_ATTENTION"|"SEND_EMAIL_TEMPLATE"|"SEND_WHATSAPP_TEMPLATE";
     operatorNextStep:"CHECK_SAVED_OUTBOX_AND_PROVIDER_RECEIPT"|
       "REVIEW_ACTION_AND_RETRY_BUDGET"|"INSPECT_REPLAY_IDEMPOTENCY"|
       "RECONCILE_WORKFLOW_COMPLETION";
     ownerApprovalRequired:true}>;
   providerDeliveryProven:false;
   automaticRetry:false;customerMessageSent:false;providerCalled:false;
   published:false;moneyChanged:false;modelInvoked:false;
 }};
const deny=(code:Extract<F07WorkflowCriticResult,{ok:false}>["code"]):F07WorkflowCriticResult=>({ok:false,code});
const id=(v:unknown):v is string=>typeof v==="string"&&/^[A-Za-z0-9:_-]{3,128}$/.test(v);
const timestamp=(v:unknown)=>trustedQuoteInstant(v);
function owned(v:unknown,fields:readonly string[]):v is Record<string,unknown>{
 try{
  if(!v||typeof v!=="object"||Array.isArray(v)||Object.getPrototypeOf(v)!==Object.prototype)return false;
  const d=Object.getOwnPropertyDescriptors(v);return fields.every(x=>Object.hasOwn(d,x)&&Object.hasOwn(d[x],"value"))&&
   Object.values(d).every(x=>Object.hasOwn(x,"value"))&&Reflect.ownKeys(v).length===Object.keys(v).length;
 }catch{return false;}
}
function inertArray(v:unknown,cap:number):v is Record<string,unknown>[]{
 try{
  if(!Array.isArray(v)||Object.getPrototypeOf(v)!==Array.prototype||v.length>=cap||
     Reflect.ownKeys(v).length!==v.length+1)return false;
  return v.every(x=>owned(x,[]));
 }catch{return false;}
}
const failureCodes=new Set(["TIMEOUT","NETWORK_ERROR","RATE_LIMITED","HTTP_429","HTTP_500",
 "HTTP_502","HTTP_503","AUTHENTICATION_FAILED","CONFIGURATION_MISSING",
 "INVALID_RECIPIENT","RECIPIENT_OPTED_OUT","CONSENT_NOT_GRANTED",
 "PROVIDER_TEMPORARILY_UNAVAILABLE","RETRY_EXHAUSTED"]);
const eventTypes=new Set(["REQUEST_CREATED","QUOTE_ACCEPTED","VISIT_COMPLETED","INVOICE_PAID","ATTENTION_OPENED"]);
const actionStates=new Set(["PREVIEW_ONLY","PENDING","APPROVAL_REQUIRED","APPROVED",
 "SUCCEEDED","FAILED","SUPPRESSED"]);
const runStates=new Set(["PREVIEWED","SKIPPED","ACTIONS_PENDING","COMPLETED","PARTIAL_FAILED"]);
const actions=new Set(["CREATE_ATTENTION","SEND_EMAIL_TEMPLATE","SEND_WHATSAPP_TEMPLATE"]);
type Item=Extract<F07WorkflowCriticResult,{ok:true}>["value"]["warnings"][number];
type Proof={fingerprint:string;warnings:Item[];execs:number;actions:number};
function project(s:OperationalStaffSnapshot):Proof|null{
 if(s.workflowAvailable!==true||s.branchScope?.mode!=="ALL"||
    !inertArray(s.workflowExecutions,1000)||!inertArray(s.workflowActionExecutions,2000))return null;
 const branchIds=new Set(s.branchScope.branches.map(b=>b.id));
 if(!branchIds.size||branchIds.size!==s.branchScope.branches.length)return null;
 const executions=new Map<string,Record<string,unknown>>();
 for(const e of s.workflowExecutions){
  if(!owned(e,["id","branchId","ruleId","ruleVersionId","mode","eventType","state","createdAt","recursionDepth"])||
     !id(e.id)||executions.has(e.id as string)||!branchIds.has(e.branchId as string)||
     !id(e.ruleId)||!id(e.ruleVersionId)||
     !["LIVE","PREVIEW"].includes(e.mode as string)||
     !eventTypes.has(e.eventType as string)||!runStates.has(e.state as string)||
     !Number.isSafeInteger(e.recursionDepth)||Number(e.recursionDepth)<0||Number(e.recursionDepth)>2||
     timestamp(e.createdAt)===null||
     (e.completedAt!==undefined&&(timestamp(e.completedAt)===null||
        timestamp(e.completedAt)!<timestamp(e.createdAt)!)))return null;
  executions.set(e.id as string,e);
 }
 const actionById=new Map<string,Record<string,unknown>>();
 const attemptKeys=new Set<string>();
 for(const a of s.workflowActionExecutions){
  if(!owned(a,["id","branchId","executionId","actionIndex","attemptNumber","actionType","state","createdAt"])||
     !id(a.id)||actionById.has(a.id as string)||!id(a.executionId)||
     !executions.has(a.executionId as string)||
     a.branchId!==executions.get(a.executionId as string)?.branchId||
     !Number.isSafeInteger(a.actionIndex)||Number(a.actionIndex)<0||Number(a.actionIndex)>4||
     !Number.isSafeInteger(a.attemptNumber)||Number(a.attemptNumber)<1||Number(a.attemptNumber)>12||
     !actions.has(a.actionType as string)||!actionStates.has(a.state as string)||
     timestamp(a.createdAt)===null||
     (a.completedAt!==undefined&&(timestamp(a.completedAt)===null||
       timestamp(a.completedAt)!<timestamp(a.createdAt)!))||
     (a.errorCode!==undefined&&(typeof a.errorCode!=="string"||a.errorCode.length>1024))||
     (a.replayOfActionExecutionId!==undefined&&!id(a.replayOfActionExecutionId)))return null;
  const key=[a.executionId,a.actionIndex,a.attemptNumber].join(":");
  if(attemptKeys.has(key))return null;
  attemptKeys.add(key);actionById.set(a.id as string,a);
 }
 for(const a of actionById.values()){
  if(a.replayOfActionExecutionId===undefined)continue;
  const origin=actionById.get(a.replayOfActionExecutionId as string);
  if(!origin||origin.id===a.id||origin.executionId!==a.executionId||
     origin.branchId!==a.branchId||origin.actionIndex!==a.actionIndex||
     Number(origin.attemptNumber)>=Number(a.attemptNumber)||
     timestamp(origin.createdAt)!>timestamp(a.createdAt)!)return null;
 }
 const warnings:Item[]=[];
 const append=(e:Record<string,unknown>,a:Record<string,unknown>,kind:F07WorkflowWarning,
  next:Item["operatorNextStep"])=>{
   warnings.push({executionId:e.id as string,actionId:a.id as string,
    kind,actionType:a.actionType as Item["actionType"],
    operatorNextStep:next,ownerApprovalRequired:true});
 };
 for(const a of actionById.values()){
  const e=executions.get(a.executionId as string)!;
  if(e.mode!=="LIVE")continue;
  if(a.state==="FAILED")append(e,a,"WORKFLOW_ACTION_FAILED","REVIEW_ACTION_AND_RETRY_BUDGET");
  if(e.state==="COMPLETED"&&a.state!=="SUCCEEDED"&&a.state!=="SUPPRESSED")
   append(e,a,"WORKFLOW_SUCCESS_CONTRADICTED","RECONCILE_WORKFLOW_COMPLETION");
  if(e.state==="PARTIAL_FAILED")append(e,a,"EXECUTION_PARTIAL_FAILURE","RECONCILE_WORKFLOW_COMPLETION");
  if(a.state==="SUCCEEDED"&&a.actionType!=="CREATE_ATTENTION")
   append(e,a,"PROVIDER_DELIVERY_UNVERIFIED","CHECK_SAVED_OUTBOX_AND_PROVIDER_RECEIPT");
  if(a.errorCode&&(!failureCodes.has(a.errorCode as string)))
   append(e,a,"PROVIDER_CODE_UNRECOGNIZED","REVIEW_ACTION_AND_RETRY_BUDGET");
  if(a.replayOfActionExecutionId)
   append(e,a,"REPLAY_NEEDS_DEDUP_REVIEW","INSPECT_REPLAY_IDEMPOTENCY");
 }
 warnings.sort((a,b)=>a.executionId.localeCompare(b.executionId)||
   a.actionId.localeCompare(b.actionId)||a.kind.localeCompare(b.kind));
 const slim=(v:Record<string,unknown>,fields:string[])=>fields.map(k=>v[k]??null);
 const efields=["id","branchId","ruleId","ruleVersionId","mode","eventType",
   "state","createdAt","completedAt","recursionDepth","matched"];
 const afields=["id","branchId","executionId","actionIndex","attemptNumber",
   "actionType","state","createdAt","completedAt","replayOfActionExecutionId","errorCode"];
 const fingerprint=JSON.stringify({
  workspace:s.workspace.id,
  executions:[...executions.values()].map(e=>slim(e,efields)).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))),
  actions:[...actionById.values()].map(a=>slim(a,afields)).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))),
 });
 return {fingerprint,warnings,execs:executions.size,actions:actionById.size};
}
export async function reviewF07SavedWorkflowFailures(slug:string,deps:F07WorkflowCriticDeps={}):
 Promise<F07WorkflowCriticResult>{
 if(typeof slug!=="string"||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||
    slug.length<3||slug.length>40)return deny("F07_WORKFLOW_INVALID");
 if(deps.signal?.aborted)return deny("F07_WORKFLOW_CANCELLED");
 const load=deps.loadSnapshot??loadOperationalStaffSnapshot,now=deps.now??Date.now;
 const valid=(s:OperationalStaffSnapshot)=>s.workspace.slug===slug&&id(s.workspace.id)&&
    s.actor.role==="OWNER"&&s.actor.workspaceId===s.workspace.id&&id(s.actor.userId)&&
    s.branchScope?.mode==="ALL"&&timestamp(s.loadedAt)!==null&&
    timestamp(s.loadedAt)!<=now()+60_000&&timestamp(s.loadedAt)!>=now()-300_000;
 let a:Awaited<ReturnType<Loader>>;
 try{a=await load(slug);}catch{return deny("F07_WORKFLOW_SOURCE_UNAVAILABLE");}
 if(!a.ok)return deny("F07_WORKFLOW_SOURCE_UNAVAILABLE");
 if(!valid(a.value))return deny("F07_WORKFLOW_OWNER_REQUIRED");
 const first=project(a.value);
 if(!first)return deny("F07_WORKFLOW_SOURCE_UNVERIFIED");
 if(deps.signal?.aborted)return deny("F07_WORKFLOW_CANCELLED");
 let b:Awaited<ReturnType<Loader>>;
 try{b=await load(slug);}catch{return deny("F07_WORKFLOW_SOURCE_UNAVAILABLE");}
 if(!b.ok||!valid(b.value)||a.value.workspace.id!==b.value.workspace.id||
   a.value.actor.userId!==b.value.actor.userId)return deny("F07_WORKFLOW_SOURCE_CHANGED");
 const latest=project(b.value);
 if(!latest||latest.fingerprint!==first.fingerprint)return deny("F07_WORKFLOW_SOURCE_CHANGED");
 if(deps.signal?.aborted)return deny("F07_WORKFLOW_CANCELLED");
 return {ok:true,value:{
  state:"F07_SAVED_WORKFLOW_CRITIC_OWNER_REVIEW_ONLY",
  source:"DOUBLE_READ_SCOPED_WORKFLOW_AND_ACTION_RECORDS",
  workspaceId:b.value.workspace.id,readAt:b.value.loadedAt,
  inspectedExecutions:latest.execs,inspectedActions:latest.actions,
  evidenceDigest:createHash("sha256").update(latest.fingerprint).digest("hex"),
  observedHistoricalCompletenessUnverified:true,
  warnings:latest.warnings,
  providerDeliveryProven:false,automaticRetry:false,
  customerMessageSent:false,providerCalled:false,published:false,
  moneyChanged:false,modelInvoked:false,
 }};
}
