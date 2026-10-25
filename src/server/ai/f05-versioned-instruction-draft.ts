import {createHash} from "node:crypto";
import {resolveStaffActor} from "@/features/operations/operational-product-runtime";
import {trustedQuoteInstant} from "@/features/operations/quote-validity-clock";
import type {WorkflowRuleVersionDTO,WorkflowEventType} from "@/contracts";
import {compileModelWorkflowDraft,type ProposedOwnerWorkflowDraft} from "./workflow-draft-proposal";
import {reviewAutomationRevision,type AutomationRevisionResult} from "./automation-revision-review";

type Resolver=typeof resolveStaffActor;
type Session=Extract<Awaited<ReturnType<Resolver>>,{ok:true}>["value"];
export interface F05SavedRule {
 id:string;workspaceId:string;branchId:string;status:"DRAFT"|"ACTIVE"|"PAUSED"|"ARCHIVED";
 version:number;publishedVersionNumber?:number;
}
export interface F05Source {
 activeBranch:true;
 rule:F05SavedRule|null;
 versions:WorkflowRuleVersionDTO[];
}
type SourceReader=(session:Session,branchId:string,ruleId?:string)=>Promise<F05Source|null>;
export interface F05InstructionDeps{resolveActor?:Resolver;readSource?:SourceReader;signal?:AbortSignal}
export interface F05InstructionRequest{
 workspaceSlug:string;branchId:string;instruction:string;
 ruleId?:string;expectedSavedRuleVersion?:number;
}
export interface F05SourceEvidence{
 branchId:string;ruleId:string|null;ruleRevision:number|null;
 basedOnPublishedVersion:number|null;nextReviewVersion:number;
 sourceDigest:string;
 inventoryCompletenessUnverified:true;
}
export type F05InstructionResult=
 | {ok:false;code:"F05_INPUT_INVALID"|"F05_OWNER_REQUIRED"|"F05_BRANCH_UNVERIFIED"|
   "F05_SAVED_RULE_UNVERIFIED"|"F05_VERSION_STALE"|
   "F05_INSTRUCTION_UNSUPPORTED"|"F05_COMPILER_REFUSED"|
   "F05_REVISION_REFUSED"|"F05_SOURCE_CHANGED"|"F05_CANCELLED"}
 | {ok:true;value:{
   state:"VERSIONED_OWNER_INSTRUCTION_DRAFT_REQUIRES_REVIEW";
   source:"DOUBLE_READ_SAVED_RULE_VERSION_AND_EXISTING_COMPILER";
   workspaceId:string;branchId:string;
   evidence:F05SourceEvidence;
   draft:ProposedOwnerWorkflowDraft;
   revision:Extract<AutomationRevisionResult,{ok:true}>["value"];
   persisted:false;published:false;executed:false;
   customerMessagesSent:false;financialStateMutated:false;modelInvoked:false;
   ownerApprovalRequired:true;writeTimeVersionRecheckRequired:true;
 }};
const bad=(code:Extract<F05InstructionResult,{ok:false}>["code"]):F05InstructionResult=>({ok:false,code});
const uuid=(v:unknown):v is string=>typeof v==="string"&&
 /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const slug=(v:unknown):v is string=>typeof v==="string"&&v.length>=3&&v.length<=40&&
 /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v);
const id=(v:unknown):v is string=>typeof v==="string"&&/^[A-Za-z0-9:_-]{3,128}$/.test(v);
const inert=(v:unknown):v is Record<string,unknown>=>{
 try{return !!v&&typeof v==="object"&&!Array.isArray(v)&&
   Object.getPrototypeOf(v)===Object.prototype&&
   Reflect.ownKeys(v).length===Object.keys(v).length&&
   Object.values(Object.getOwnPropertyDescriptors(v)).every(d=>Object.hasOwn(d,"value"));}
 catch{return false;}
};
const dense=(v:unknown,max:number):v is unknown[]=>{
 try{return Array.isArray(v)&&Object.getPrototypeOf(v)===Array.prototype&&
   v.length<max&&Reflect.ownKeys(v).length===v.length+1&&
   Array.from({length:v.length},(_,i)=>{
     const d=Object.getOwnPropertyDescriptor(v,String(i));
     return !!d&&Object.hasOwn(d,"value");
   }).every(Boolean);}
 catch{return false;}
};
const normalTime=(v:unknown):string|null=>{
 const ms=trustedQuoteInstant(v);return ms===null?null:new Date(ms).toISOString();
};
function owner(result:Awaited<ReturnType<Resolver>>,name:string):
 result is Extract<Awaited<ReturnType<Resolver>>,{ok:true}>{
 return result.ok&&result.value.workspace.slug===name&&
   id(result.value.workspace.id)&&result.value.actor.workspaceId===result.value.workspace.id&&
   result.value.actor.role==="OWNER"&&id(result.value.actor.userId);
}
async function directSavedRead(session:Session,branchId:string,ruleId?:string):Promise<F05Source|null>{
 const {service,workspace}=session;
 try{
  const b=await service.from("workspace_branches")
    .select("id,workspace_id,active").eq("workspace_id",workspace.id)
    .eq("id",branchId).eq("active",true).maybeSingle();
  if(b.error||!b.data||b.data.id!==branchId||
      b.data.workspace_id!==workspace.id||b.data.active!==true)return null;
  if(!ruleId)return {activeBranch:true,rule:null,versions:[]};
  const [saved,history]=await Promise.all([
    service.from("workflow_rules")
      .select("id,workspace_id,branch_id,status,version,published_version_number")
      .eq("workspace_id",workspace.id).eq("branch_id",branchId)
      .eq("id",ruleId).maybeSingle(),
    service.from("workflow_rule_versions")
      .select("id,workspace_id,branch_id,rule_id,version_number,state,event_type,conditions,actions,max_actions_per_event,based_on_version_number,published_at,created_at")
      .eq("workspace_id",workspace.id).eq("branch_id",branchId)
      .eq("rule_id",ruleId).order("version_number",{ascending:true}).limit(101),
  ]);
  if(saved.error||history.error||!saved.data||!Array.isArray(history.data)||
     history.data.length>=101)return null;
  const raw=saved.data;
  const rule:F05SavedRule={
    id:String(raw.id),workspaceId:String(raw.workspace_id),branchId:String(raw.branch_id),
    status:String(raw.status) as F05SavedRule["status"],version:Number(raw.version),
    ...(raw.published_version_number===null||raw.published_version_number===undefined?{}:
       {publishedVersionNumber:Number(raw.published_version_number)}),
  };
  const versions:WorkflowRuleVersionDTO[]=[];
  for(const row of history.data){
   if(!row||!Array.isArray(row.conditions)||!Array.isArray(row.actions))return null;
   const created=normalTime(row.created_at);
   const published=row.published_at?normalTime(row.published_at):undefined;
   if(!created||(row.published_at&&!published))return null;
   versions.push({
    id:String(row.id),workspaceId:String(row.workspace_id),
    branchId:String(row.branch_id),ruleId:String(row.rule_id),
    versionNumber:Number(row.version_number),state:String(row.state) as WorkflowRuleVersionDTO["state"],
    eventType:String(row.event_type) as WorkflowRuleVersionDTO["eventType"],
    conditions:row.conditions,actions:row.actions,
    maxActionsPerEvent:Number(row.max_actions_per_event),
    ...(row.based_on_version_number===null||row.based_on_version_number===undefined?{}:
       {basedOnVersionNumber:Number(row.based_on_version_number)}),
    ...(published?{publishedAt:published}:{}),createdAt:created,
   });
  }
  return {activeBranch:true,rule,versions};
 }catch{return null;}
}
interface Verified{fingerprint:string;previous:WorkflowRuleVersionDTO|null;
 evidence:F05SourceEvidence}
function proof(source:F05Source,workspaceId:string,branchId:string,ruleId?:string):Verified|null{
 if(!inert(source)||source.activeBranch!==true||
    !dense(source.versions,101)||source.versions.some(x=>!inert(x)) ||
    (source.rule!==null&&!inert(source.rule)))return null;
 const rule=source.rule,items=source.versions;
 if(!ruleId && (rule!==null||items.length!==0))return null;
 if(ruleId && (!rule||rule.id!==ruleId||rule.branchId!==branchId||
    rule.workspaceId!==workspaceId||
    !["DRAFT","ACTIVE","PAUSED"].includes(rule.status)||
    !Number.isSafeInteger(rule.version)||rule.version<1))return null;
 const byNumber=new Set<number>(),byId=new Set<string>();
 for(const v of items){
  if(!id(v.id)||!id(v.ruleId)||v.ruleId!==ruleId||
     v.workspaceId!==workspaceId||v.branchId!==branchId||
     !Number.isSafeInteger(v.versionNumber)||v.versionNumber<1||
     byNumber.has(v.versionNumber)||byId.has(v.id)||
     !["DRAFT","PUBLISHED","RETIRED"].includes(v.state)||
     !dense(v.conditions,9)||!dense(v.actions,6)||
     !Number.isSafeInteger(v.maxActionsPerEvent)||
     v.maxActionsPerEvent<1||v.maxActionsPerEvent>5||
     v.actions.length>v.maxActionsPerEvent||
     normalTime(v.createdAt)===null)return null;
  byNumber.add(v.versionNumber);byId.add(v.id);
 }
 if(ruleId&&(items.length===0||items.some(v=>v.state==="DRAFT")))return null;
 const published=items.filter(x=>x.state==="PUBLISHED")
   .sort((a,b)=>b.versionNumber-a.versionNumber);
 if(ruleId&&(!published.length||published.length!==1||
    rule!.publishedVersionNumber!==published[0].versionNumber||
    Math.max(...items.map(x=>x.versionNumber))!==published[0].versionNumber))
    return null;
 const previous=published[0]??null;
 const version=previous?previous.versionNumber+1:1;
 const sourceProjection={
   rule:rule?{
     id:rule.id,workspaceId:rule.workspaceId,branchId:rule.branchId,
     status:rule.status,version:rule.version,publishedVersionNumber:rule.publishedVersionNumber??null,
   }:null,
   versions:items.map(v=>({
     id:v.id,ruleId:v.ruleId,workspaceId:v.workspaceId,branchId:v.branchId,
     versionNumber:v.versionNumber,state:v.state,eventType:v.eventType,
     conditions:v.conditions,actions:v.actions,maxActionsPerEvent:v.maxActionsPerEvent,
     basedOnVersionNumber:v.basedOnVersionNumber??null,
     createdAt:v.createdAt,publishedAt:v.publishedAt??null,
   })).sort((a,b)=>a.versionNumber-b.versionNumber),
 };
 const fingerprint=JSON.stringify(sourceProjection);
 const digest=createHash("sha256").update(fingerprint).digest("hex");
 return {fingerprint,previous,evidence:{
   branchId,ruleId:ruleId??null,ruleRevision:rule?.version??null,
   basedOnPublishedVersion:previous?.versionNumber??null,
   nextReviewVersion:version,sourceDigest:digest,
   inventoryCompletenessUnverified:true,
 }};
}
const phrases:readonly [string,WorkflowEventType][]=[
 ["a request is created","REQUEST_CREATED"],
 ["a quote is accepted","QUOTE_ACCEPTED"],
 ["a visit is completed","VISIT_COMPLETED"],
 ["an invoice is paid","INVOICE_PAID"],
 ["an attention is opened","ATTENTION_OPENED"],
];
function typedInstruction(value:unknown):{eventType:WorkflowEventType;
 severity:"INFO"|"WARNING"|"CRITICAL";serviceCode?:"STANDARD"|"DEEP"|"MOVE_OUT"}|null{
 if(typeof value!=="string"||value.length>180||
    /[\u0000-\u001f\u007f-\u009f]/u.test(value))return null;
 const match=/^When (a request is created|a quote is accepted|a visit is completed|an invoice is paid|an attention is opened), create (INFO|WARNING|CRITICAL) internal attention(?: for (STANDARD|DEEP|MOVE_OUT))?\.$/i.exec(value);
 if(!match)return null;
 const eventType=phrases.find(([phrase])=>phrase===match[1].toLowerCase())?.[1];
 if(!eventType)return null;
 const severity=match[2].toUpperCase() as "INFO"|"WARNING"|"CRITICAL";
 const serviceCode=match[3]?.toUpperCase() as "STANDARD"|"DEEP"|"MOVE_OUT"|undefined;
 return {eventType,severity,...(serviceCode?{serviceCode}:{})};
}
export async function prepareF05VersionedInstructionDraft(
 input:F05InstructionRequest,deps:F05InstructionDeps={},
):Promise<F05InstructionResult>{
 if(!inert(input)||!slug(input.workspaceSlug)||!uuid(input.branchId)||
    (input.ruleId!==undefined&&!uuid(input.ruleId))||
    (input.ruleId===undefined&&input.expectedSavedRuleVersion!==undefined)||
    (input.ruleId!==undefined&&(!Number.isSafeInteger(input.expectedSavedRuleVersion)||
      input.expectedSavedRuleVersion < 1)) ||
    Object.keys(input).some(k=>!["workspaceSlug","branchId","instruction","ruleId","expectedSavedRuleVersion"].includes(k)))
    return bad("F05_INPUT_INVALID");
 const suggestion=typedInstruction(input.instruction);
 if(!suggestion)return bad("F05_INSTRUCTION_UNSUPPORTED");
 if(deps.signal?.aborted)return bad("F05_CANCELLED");
 const resolve=deps.resolveActor??resolveStaffActor,read=deps.readSource??directSavedRead;
 let first:Awaited<ReturnType<Resolver>>;
 try{first=await resolve(input.workspaceSlug);}catch{return bad("F05_OWNER_REQUIRED");}
 if(!owner(first,input.workspaceSlug))return bad("F05_OWNER_REQUIRED");
 const {id:workspaceId}=first.value.workspace,userId=first.value.actor.userId;
 let s1:F05Source|null;
 try{s1=await read(first.value,input.branchId,input.ruleId);}catch{s1=null;}
 if(!s1)return bad("F05_BRANCH_UNVERIFIED");
 const p1=proof(s1,workspaceId,input.branchId,input.ruleId);
 if(!p1)return bad("F05_SAVED_RULE_UNVERIFIED");
 if(input.ruleId&&s1.rule?.version!==input.expectedSavedRuleVersion)
   return bad("F05_VERSION_STALE");
 const draft=compileModelWorkflowDraft(suggestion,{workspaceId,actorWorkspaceId:workspaceId,
   branchId:input.branchId,role:"OWNER"});
 if(!draft.ok||draft.value.actions.length!==1||
    draft.value.actions[0]?.type!=="CREATE_ATTENTION")return bad("F05_COMPILER_REFUSED");
 const ruleId=input.ruleId??"f05-unsaved-rule";
 const previewVersion:WorkflowRuleVersionDTO={
   id:"f05-unsaved-version",ruleId,workspaceId,branchId:input.branchId,
   versionNumber:p1.evidence.nextReviewVersion,state:"DRAFT",
   eventType:draft.value.eventType,
   conditions:draft.value.conditions,actions:draft.value.actions,
   maxActionsPerEvent:draft.value.maxActionsPerEvent,
   ...(p1.previous?{basedOnVersionNumber:p1.previous.versionNumber}:{}),
   createdAt:"2026-10-25T00:00:00.000Z",
 };
 const revision=reviewAutomationRevision({workspaceId,branchId:input.branchId,
   actor:{workspaceId,role:"OWNER"},previous:p1.previous,draft:previewVersion});
 if(!revision.ok)return bad("F05_REVISION_REFUSED");
 if(deps.signal?.aborted)return bad("F05_CANCELLED");
 let second:Awaited<ReturnType<Resolver>>;
 try{second=await resolve(input.workspaceSlug);}catch{return bad("F05_SOURCE_CHANGED");}
 if(!owner(second,input.workspaceSlug)||second.value.workspace.id!==workspaceId||
    second.value.actor.userId!==userId)return bad("F05_SOURCE_CHANGED");
 let s2:F05Source|null;
 try{s2=await read(second.value,input.branchId,input.ruleId);}catch{s2=null;}
 const p2=s2?proof(s2,workspaceId,input.branchId,input.ruleId):null;
 if(!p2||p2.fingerprint!==p1.fingerprint||
    (input.ruleId&&s2?.rule?.version!==input.expectedSavedRuleVersion))
    return bad("F05_SOURCE_CHANGED");
 if(deps.signal?.aborted)return bad("F05_CANCELLED");
 return {ok:true,value:{
   state:"VERSIONED_OWNER_INSTRUCTION_DRAFT_REQUIRES_REVIEW",
   source:"DOUBLE_READ_SAVED_RULE_VERSION_AND_EXISTING_COMPILER",
   workspaceId,branchId:input.branchId,evidence:p2.evidence,
   draft:draft.value,revision:revision.value,
   persisted:false,published:false,executed:false,
   customerMessagesSent:false,financialStateMutated:false,modelInvoked:false,
   ownerApprovalRequired:true,writeTimeVersionRecheckRequired:true,
 }};
}
