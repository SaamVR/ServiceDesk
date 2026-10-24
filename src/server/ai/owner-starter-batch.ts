import type {WorkflowActionDTO,WorkflowConditionDTO,WorkflowEventType} from "../../contracts";
import {resolveStaffActor} from "@/features/operations/operational-product-runtime";
import {automationPlaybooks} from "@/features/operations/automation-playbooks";

type Resolver=typeof resolveStaffActor;
type BranchVerifier=(service:Extract<Awaited<ReturnType<Resolver>>,{ok:true}>["value"]["service"],
 workspaceId:string,branchId:string)=>Promise<boolean>;
export interface AutomationDraftBatchDependencies{
 resolveActor?:Resolver;verifyBranch?:BranchVerifier;signal?:AbortSignal;
}
export interface AutomationStarterDraft {
 state:"UNPERSISTED_OWNER_RULE_DRAFT";
 starterId:string;code:string;
 eventType:WorkflowEventType;
 conditions:WorkflowConditionDTO[];
 actions:WorkflowActionDTO[];
 maxActionsPerEvent:1;
 requiresOwnerReview:true;
 persisted:false;published:false;
 providerMessagesSent:false;paymentChanged:false;
}
export type OwnerAutomationBatchResult=
 | {ok:false;code:"BATCH_INPUT_INVALID"|"BATCH_OWNER_REQUIRED"|"BATCH_BRANCH_UNVERIFIED"|"BATCH_ACCESS_CHANGED"|"BATCH_CANCELLED"}
 | {ok:true;value:{
   state:"OWNER_STARTER_DRAFT_BATCH_REQUIRES_REVIEW";
   source:"TRUSTED_27_STARTER_CATALOG_SAVED_BRANCH";
   workspaceId:string;branchId:string;
   drafts:AutomationStarterDraft[];
   selectedCount:number;ownerPublishRequired:true;
   persisted:false;published:false;executed:false;
   modelInvoked:false;providerMessagesSent:false;paymentChanged:false;
 }};
const slugOk=(s:unknown):s is string=>typeof s==="string"&&
 s.length>=3&&s.length<=40&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s);
const uuid=(v:unknown):v is string=>typeof v==="string"&&
 /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
function captureSelection(value:unknown):readonly string[]|null{
 // A previously validated external Array or Proxy can replace .map() or
 // numeric reads. Copy ONLY inert indexed descriptor VALUES once, then use
 // the trusted local snapshot for ALL later authorization and catalogue work.
 try {
  if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype)
   return null;
  const descriptors=Object.getOwnPropertyDescriptors(value);
  const length=Object.getOwnPropertyDescriptor(value,"length")?.value;
  if(!Number.isSafeInteger(length)||length<1||length>12||
     Reflect.ownKeys(value).length!==length+1)return null;
  const seen=new Set<string>(),selected:string[]=[];
  for(let i=0;i<length;i++){
   const entry=descriptors[String(i)];
   if(!entry||!Object.hasOwn(entry,"value")||
      typeof entry.value!=="string"||
      !/^[a-z0-9-]{3,80}$/.test(entry.value)||
      seen.has(entry.value))return null;
   seen.add(entry.value);
   selected.push(entry.value);
  }
  return Object.freeze(selected);
 } catch {return null;}
}
function owner(resolved:Awaited<ReturnType<Resolver>>,slug:string):
 resolved is Extract<Awaited<ReturnType<Resolver>>,{ok:true}>{
 return resolved.ok&&resolved.value.workspace.slug===slug&&
  resolved.value.workspace.id===resolved.value.actor.workspaceId&&
  resolved.value.actor.role==="OWNER"&&!!resolved.value.actor.userId;
}
async function savedBranch(
 service:Extract<Awaited<ReturnType<Resolver>>,{ok:true}>["value"]["service"],
 workspaceId:string,branchId:string,
):Promise<boolean>{
 try{
  // The real persisted branch authority is workspace_branches. Never rely
  // on an unrelated/absent generic "branches" relation or display DTO alone.
  const r=await service.from("workspace_branches")
   .select("id,workspace_id,active")
   .eq("workspace_id",workspaceId).eq("id",branchId)
   .eq("active",true).maybeSingle();
  return !r.error&&!!r.data&&r.data.id===branchId&&
    r.data.workspace_id===workspaceId&&r.data.active===true;
 }catch{return false;}
}
/** A batch of 27-catalog STARTER previews, not 27 live rule installations.
 * Only the original allowlisted internal-attention action can be prepared;
 * every draft remains unpublished until owner review and authoritative save. */
export async function prepareAuthorizedAutomationStarterBatch(
 workspaceSlug:string,branchId:string,starterIds:unknown,
 deps:AutomationDraftBatchDependencies={},
):Promise<OwnerAutomationBatchResult>{
 const selectedIds=captureSelection(starterIds);
 if(!slugOk(workspaceSlug)||!uuid(branchId)||!selectedIds)
  return {ok:false,code:"BATCH_INPUT_INVALID"};
 if(deps.signal?.aborted)return {ok:false,code:"BATCH_CANCELLED"};
 const selected=selectedIds.map(id=>automationPlaybooks.find(p=>p.id===id));
 if(selected.some(p=>!p||!["INFO","WARNING","CRITICAL"].includes(p.severity)||
    !/^[A-Z0-9_]{3,80}$/.test(p.actionDetail)||
    !["REQUEST_CREATED","QUOTE_ACCEPTED","VISIT_COMPLETED","INVOICE_PAID","ATTENTION_OPENED"].includes(p.eventType)))
  return {ok:false,code:"BATCH_INPUT_INVALID"};
 const resolver=deps.resolveActor??resolveStaffActor;
 const verify=deps.verifyBranch??savedBranch;
 const checkBranch=async(service:Extract<Awaited<ReturnType<Resolver>>,{ok:true}>["value"]["service"],
  wid:string,bid:string)=>{
  try{return (await verify(service,wid,bid))===true;}catch{return false;}
 };
 let first:Awaited<ReturnType<Resolver>>;
 try{first=await resolver(workspaceSlug);}catch{return {ok:false,code:"BATCH_OWNER_REQUIRED"};}
 if(!owner(first,workspaceSlug))return {ok:false,code:"BATCH_OWNER_REQUIRED"};
 const workspaceId=first.value.workspace.id,userId=first.value.actor.userId;
 if(!(await checkBranch(first.value.service,workspaceId,branchId)))
  return {ok:false,code:"BATCH_BRANCH_UNVERIFIED"};
 const drafts:AutomationStarterDraft[]=selected.map(p=>({
  state:"UNPERSISTED_OWNER_RULE_DRAFT",starterId:p!.id,code:p!.code,
  eventType:p!.eventType,
  conditions:p!.condition?[{...p!.condition}]:[],
  actions:[{type:"CREATE_ATTENTION",severity:p!.severity,summaryKey:p!.actionDetail}],
  maxActionsPerEvent:1,requiresOwnerReview:true,
  persisted:false,published:false,providerMessagesSent:false,paymentChanged:false,
 }));
 if(deps.signal?.aborted)return {ok:false,code:"BATCH_CANCELLED"};
 let latest:Awaited<ReturnType<Resolver>>;
 try{latest=await resolver(workspaceSlug);}catch{return {ok:false,code:"BATCH_ACCESS_CHANGED"};}
 if(!owner(latest,workspaceSlug)||latest.value.workspace.id!==workspaceId||
    latest.value.actor.userId!==userId||
    !(await checkBranch(latest.value.service,workspaceId,branchId)))
  return {ok:false,code:"BATCH_ACCESS_CHANGED"};
 if(deps.signal?.aborted)return {ok:false,code:"BATCH_CANCELLED"};
 return {ok:true,value:{
  state:"OWNER_STARTER_DRAFT_BATCH_REQUIRES_REVIEW",
  source:"TRUSTED_27_STARTER_CATALOG_SAVED_BRANCH",
  workspaceId,branchId,drafts,selectedCount:drafts.length,
  ownerPublishRequired:true,persisted:false,published:false,executed:false,
  modelInvoked:false,providerMessagesSent:false,paymentChanged:false}};
}
