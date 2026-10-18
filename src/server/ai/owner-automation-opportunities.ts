import {resolveStaffActor} from "@/features/operations/operational-product-runtime";
import {loadOwnerWorkdayPriorities, type OwnerWorkdayResult} from "./owner-workday-priorities";
import {compileModelWorkflowDraft,type ProposedOwnerWorkflowDraft} from "./workflow-draft-proposal";

type Resolver=typeof resolveStaffActor;
type Workday=typeof loadOwnerWorkdayPriorities;
type BranchCheck=(service:Extract<Awaited<ReturnType<Resolver>>,{ok:true}>["value"]["service"],
 workspaceId:string,branchId:string)=>Promise<boolean>;
export interface OwnerAutomationOpportunityDependencies{
 resolveActor?:Resolver;loadWorkday?:Workday;verifyBranch?:BranchCheck;signal?:AbortSignal;
}
export type OwnerAutomationOpportunitiesResult=
 | {ok:false;code:"OPPORTUNITY_INPUT_INVALID"|"OPPORTUNITY_OWNER_REQUIRED"|
   "OPPORTUNITY_BRANCH_UNVERIFIED"|"OPPORTUNITY_WORKDAY_UNAVAILABLE"|
   "OPPORTUNITY_AUTH_CHANGED"|"OPPORTUNITY_CANCELLED"}
 | {ok:true;value:{
   state:"OWNER_SAVED_SIGNALS_FUTURE_RULE_DRAFTS_ONLY";
   source:"DOUBLE_CHECKED_OWNER_WORKDAY_AND_SAVED_BRANCH";
   workspaceId:string;branchId:string;inspectedPriorities:number;
   suggestions:Array<{evidenceKey:"OPEN_REQUEST"|"CRITICAL_ATTENTION";
     savedCount:number;target:"FUTURE_REQUEST_CREATED"|"FUTURE_ATTENTION_OPENED";
     draft:ProposedOwnerWorkflowDraft;
     existingCasesProcessed:false;published:false;requiresOwnerApproval:true;}>;
   skippedPriorities:number;modelInvoked:false;published:false;
   providerMessagesSent:false;financialStateChanged:false;}};
const uuid=(v:unknown):v is string=>typeof v==="string" &&
 /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const slugOk=(v:unknown)=>typeof v==="string"&&v.length>=3&&v.length<=40&&
 /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v);
function owner(a:Awaited<ReturnType<Resolver>>,slug:string):a is Extract<Awaited<ReturnType<Resolver>>,{ok:true}>{
 return a.ok&&a.value.workspace.slug===slug&&
  a.value.workspace.id===a.value.actor.workspaceId&&
  a.value.actor.role==="OWNER"&&!!a.value.actor.userId;
}
async function savedBranch(service:Extract<Awaited<ReturnType<Resolver>>,{ok:true}>["value"]["service"],
 workspaceId:string,branchId:string):Promise<boolean>{
 try{const r=await service.from("branches").select("id,workspace_id")
  .eq("id",branchId).eq("workspace_id",workspaceId).maybeSingle();
  return !r.error&&!!r.data&&r.data.id===branchId&&r.data.workspace_id===workspaceId;
 }catch{return false;}
}
/** Backlog is evidence of a possible automation need, NOT evidence that
 * historical tasks were acted on. Only safe future-event draft suggestions
 * are generated, never retrospective sends/commands. */
export async function suggestOwnerAutomationOpportunities(
 slug:string,branchId:string,deps:OwnerAutomationOpportunityDependencies={},
):Promise<OwnerAutomationOpportunitiesResult>{
 if(!slugOk(slug)||!uuid(branchId))return {ok:false,code:"OPPORTUNITY_INPUT_INVALID"};
 if(deps.signal?.aborted)return {ok:false,code:"OPPORTUNITY_CANCELLED"};
 const resolve=deps.resolveActor??resolveStaffActor;
 const verify=deps.verifyBranch??savedBranch;
 let first:Awaited<ReturnType<Resolver>>;
 try{first=await resolve(slug);}catch{return {ok:false,code:"OPPORTUNITY_OWNER_REQUIRED"};}
 if(!owner(first,slug))return {ok:false,code:"OPPORTUNITY_OWNER_REQUIRED"};
 const workspaceId=first.value.workspace.id,userId=first.value.actor.userId;
 if(!(await verify(first.value.service,workspaceId,branchId)))
   return {ok:false,code:"OPPORTUNITY_BRANCH_UNVERIFIED"};
 if(deps.signal?.aborted)return {ok:false,code:"OPPORTUNITY_CANCELLED"};
 let workday:Awaited<ReturnType<Workday>>;
 try{workday=await (deps.loadWorkday??loadOwnerWorkdayPriorities)(slug);}
 catch{return {ok:false,code:"OPPORTUNITY_WORKDAY_UNAVAILABLE"};}
 if(!workday.ok||workday.value.state!=="VERIFIED_OWNER_WORKDAY_REVIEW"||
    workday.value.source!=="DOUBLE_CHECKED_SAVED_WORKSPACE_COUNTS"||
    workday.value.workspaceId!==workspaceId||
    !Array.isArray(workday.value.priorities)||workday.value.priorities.length>7)
   return {ok:false,code:"OPPORTUNITY_WORKDAY_UNAVAILABLE"};
 const pairs=[
  {key:"CRITICAL_ATTENTION" as const,eventType:"ATTENTION_OPENED" as const,
   target:"FUTURE_ATTENTION_OPENED" as const,severity:"CRITICAL" as const},
  {key:"OPEN_REQUEST" as const,eventType:"REQUEST_CREATED" as const,
   target:"FUTURE_REQUEST_CREATED" as const,severity:"WARNING" as const},
 ];
 const suggestions:Extract<OwnerAutomationOpportunitiesResult,{ok:true}>["value"]["suggestions"]=[];
 const seen=new Set<string>();
 for(const p of workday.value.priorities){
   if(!p||typeof p.key!=="string"||seen.has(p.key)||
      !Number.isSafeInteger(p.count)||p.count<1||p.count>5000||
      p.source!=="VERIFIED_SAVED_QUEUE_COUNT")
     return {ok:false,code:"OPPORTUNITY_WORKDAY_UNAVAILABLE"};
   seen.add(p.key);
 }
 for(const item of pairs){
   const signal=workday.value.priorities.find(p=>p.key===item.key);
   if(!signal)continue;
   const draft=compileModelWorkflowDraft({eventType:item.eventType,severity:item.severity},{
    workspaceId,branchId,actorWorkspaceId:workspaceId,role:"OWNER"});
   if(!draft.ok)return {ok:false,code:"OPPORTUNITY_WORKDAY_UNAVAILABLE"};
   suggestions.push({evidenceKey:item.key,savedCount:signal.count,target:item.target,
     draft:draft.value,existingCasesProcessed:false,published:false,requiresOwnerApproval:true});
 }
 if(deps.signal?.aborted)return {ok:false,code:"OPPORTUNITY_CANCELLED"};
 let second:Awaited<ReturnType<Resolver>>;
 try{second=await resolve(slug);}catch{return {ok:false,code:"OPPORTUNITY_AUTH_CHANGED"};}
 if(!owner(second,slug)||second.value.workspace.id!==workspaceId||
    second.value.actor.userId!==userId||
    !(await verify(second.value.service,workspaceId,branchId)))
   return {ok:false,code:"OPPORTUNITY_AUTH_CHANGED"};
 if(deps.signal?.aborted)return {ok:false,code:"OPPORTUNITY_CANCELLED"};
 return {ok:true,value:{
   state:"OWNER_SAVED_SIGNALS_FUTURE_RULE_DRAFTS_ONLY",
   source:"DOUBLE_CHECKED_OWNER_WORKDAY_AND_SAVED_BRANCH",
   workspaceId,branchId,inspectedPriorities:workday.value.priorities.length,
   suggestions,skippedPriorities:workday.value.priorities.length-suggestions.length,
   modelInvoked:false,published:false,providerMessagesSent:false,financialStateChanged:false}};
}
