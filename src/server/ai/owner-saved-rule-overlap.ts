import type {WorkflowRuleVersionDTO} from "../../contracts";
import {resolveStaffActor} from "@/features/operations/operational-product-runtime";
import {reviewSavedRuleOverlap,type SavedRuleOverlapResult} from "./saved-rule-overlap-review";
import type {ProposedOwnerWorkflowDraft} from "./workflow-draft-proposal";

type Resolver=typeof resolveStaffActor;
type OwnerSession=Extract<Awaited<ReturnType<Resolver>>,{ok:true}>;
type SavedRead=(service:OwnerSession["value"]["service"],
  workspaceId:string,branchId:string)=>Promise<WorkflowRuleVersionDTO[]|null>;
type BranchRead=(service:OwnerSession["value"]["service"],
  workspaceId:string,branchId:string)=>Promise<boolean>;
export interface OwnerPublishedRuleOverlapDeps{
 resolveActor?:Resolver;loadPublished?:SavedRead;verifyBranch?:BranchRead;signal?:AbortSignal;
}
export type AuthorizedSavedRuleOverlapResult=
 | {ok:false;code:"RULE_OWNER_INPUT_INVALID"|"RULE_OWNER_REQUIRED"|
   "RULE_OWNER_BRANCH_UNVERIFIED"|"RULE_OWNER_INVENTORY_UNVERIFIED"|
   "RULE_OWNER_SOURCE_CHANGED"|"RULE_OWNER_CANCELLED"}
 | {ok:true;value:Extract<SavedRuleOverlapResult,{ok:true}>["value"]&{
   ownerAndPublishedInventoryDoubleChecked:true;
   persistedRulePagesComplete:true;
   reviewOnly:true;}};
const uuid=(v:unknown):v is string=>typeof v==="string"&&
 /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const slug=(v:unknown):v is string=>typeof v==="string"&&v.length>=3&&v.length<=40&&
 /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v);
function owner(a:Awaited<ReturnType<Resolver>>,name:string):a is OwnerSession {
 return a.ok&&a.value.workspace.slug===name&&
  a.value.actor.role==="OWNER"&&!!a.value.actor.userId&&
  a.value.workspace.id===a.value.actor.workspaceId;
}
async function branchCheck(s:OwnerSession["value"]["service"],ws:string,id:string):Promise<boolean>{
 try{
   const r=await s.from("branches").select("id,workspace_id")
    .eq("id",id).eq("workspace_id",ws).maybeSingle();
   return !r.error&&!!r.data&&r.data.id===id&&r.data.workspace_id===ws;
 }catch{return false;}
}
async function publishedRead(s:OwnerSession["value"]["service"],ws:string,branch:string):Promise<WorkflowRuleVersionDTO[]|null>{
 try{
  // Request limit+1 rows to detect an incomplete result page. Never accept
  // a seemingly zero-conflict report when inventory may be truncated.
  const r=await s.from("workflow_rule_versions")
   .select("id,workspace_id,branch_id,rule_id,version_number,state,event_type,conditions,actions,max_actions_per_event,created_at")
   .eq("workspace_id",ws).eq("branch_id",branch).eq("state","PUBLISHED")
   .order("rule_id",{ascending:true}).limit(201);
  if(r.error||!Array.isArray(r.data)||r.data.length>200)return null;
  const output:WorkflowRuleVersionDTO[]=[];
  for(const raw of r.data){
    if(!raw||typeof raw!=="object"||
      typeof raw.id!=="string"||typeof raw.workspace_id!=="string"||
      typeof raw.branch_id!=="string"||typeof raw.rule_id!=="string"||
      typeof raw.event_type!=="string"||typeof raw.created_at!=="string"||
      typeof raw.version_number!=="number"||
      typeof raw.max_actions_per_event!=="number"||
      !Array.isArray(raw.conditions)||!Array.isArray(raw.actions)||
      raw.state!=="PUBLISHED")return null;
    output.push({id:raw.id,workspaceId:raw.workspace_id,branchId:raw.branch_id,
      ruleId:raw.rule_id,versionNumber:raw.version_number,
      state:"PUBLISHED",eventType:raw.event_type as WorkflowRuleVersionDTO["eventType"],
      conditions:raw.conditions,actions:raw.actions,
      maxActionsPerEvent:raw.max_actions_per_event,createdAt:raw.created_at});
  }
  return output;
 }catch{return null;}
}

/** Two saved owner/branch/inventory reads and exact normalized equality.
 * Does not use personal Codex, publish rules, or execute business events. */
export async function reviewAuthorizedSavedOwnerRules(
 workspaceSlug:string,branchId:string,proposed:readonly ProposedOwnerWorkflowDraft[],
 deps:OwnerPublishedRuleOverlapDeps={},
):Promise<AuthorizedSavedRuleOverlapResult>{
 if(!slug(workspaceSlug)||!uuid(branchId))
   return {ok:false,code:"RULE_OWNER_INPUT_INVALID"};
 if(deps.signal?.aborted)return {ok:false,code:"RULE_OWNER_CANCELLED"};
 const resolver=deps.resolveActor??resolveStaffActor;
 const check=deps.verifyBranch??branchCheck,load=deps.loadPublished??publishedRead;
 let first:Awaited<ReturnType<Resolver>>;
 try{first=await resolver(workspaceSlug);}catch{return {ok:false,code:"RULE_OWNER_REQUIRED"};}
 if(!owner(first,workspaceSlug))return {ok:false,code:"RULE_OWNER_REQUIRED"};
 const ws=first.value.workspace.id,userId=first.value.actor.userId;
 let branchOk=false;
 try{branchOk=await check(first.value.service,ws,branchId);}catch{}
 if(!branchOk)return {ok:false,code:"RULE_OWNER_BRANCH_UNVERIFIED"};
 if(deps.signal?.aborted)return {ok:false,code:"RULE_OWNER_CANCELLED"};
 let firstRows:WorkflowRuleVersionDTO[]|null;
 try{firstRows=await load(first.value.service,ws,branchId);}catch{firstRows=null;}
 if(!firstRows)return {ok:false,code:"RULE_OWNER_INVENTORY_UNVERIFIED"};
 const preview=reviewSavedRuleOverlap({actor:{workspaceId:ws,role:"OWNER"},workspaceId:ws,
   branchId,inventorySource:"SAVED_PUBLISHED_RULE_VERSIONS",
   currentPublished:firstRows,proposed});
 if(!preview.ok)return {ok:false,code:"RULE_OWNER_INVENTORY_UNVERIFIED"};
 if(deps.signal?.aborted)return {ok:false,code:"RULE_OWNER_CANCELLED"};
 let second:Awaited<ReturnType<Resolver>>;
 try{second=await resolver(workspaceSlug);}catch{return {ok:false,code:"RULE_OWNER_SOURCE_CHANGED"};}
 if(!owner(second,workspaceSlug)||second.value.workspace.id!==ws||
    second.value.actor.userId!==userId)
    return {ok:false,code:"RULE_OWNER_SOURCE_CHANGED"};
 let secondOk=false;
 try{secondOk=await check(second.value.service,ws,branchId);}catch{}
 if(!secondOk)return {ok:false,code:"RULE_OWNER_SOURCE_CHANGED"};
 let secondRows:WorkflowRuleVersionDTO[]|null;
 try{secondRows=await load(second.value.service,ws,branchId);}catch{secondRows=null;}
 if(!secondRows||JSON.stringify(firstRows)!==JSON.stringify(secondRows))
   return {ok:false,code:"RULE_OWNER_SOURCE_CHANGED"};
 if(deps.signal?.aborted)return {ok:false,code:"RULE_OWNER_CANCELLED"};
 return {ok:true,value:{...preview.value,
   ownerAndPublishedInventoryDoubleChecked:true,
   persistedRulePagesComplete:true,reviewOnly:true}};
}
