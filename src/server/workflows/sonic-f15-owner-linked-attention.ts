import type {SupabaseClient} from "@supabase/supabase-js";
import {resolveStaffActor} from "@/features/operations/operational-product-runtime";
import {operationalDatabaseMode} from "@/features/auth/operational-preview-mode";
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[0-9a-f]{12}$/i;
const slug=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
type Context={workspaceId:string;actorId:string;branches:string[];service:Pick<SupabaseClient,"from">};
export type F15AttentionProof=
 | {state:"UNAVAILABLE"|"NO_REVIEW_RECORDED"}
 | {state:"LINKED_INTERNAL_ATTENTION_VERIFIED";count:number;
   open:number;acknowledged:number;resolved:number;
   humanReviewRequired:true;workflowExecuted:false;customerMessaged:false};
export interface F15AttentionProofDeps{
 resolve?:(workspaceSlug:string)=>Promise<Context|null>;
 journal?:(service:Pick<SupabaseClient,"from">,workspaceId:string,
  branchId:string,requestId:string)=>Promise<unknown>;
 attention?:(service:Pick<SupabaseClient,"from">,workspaceId:string,
  reviewIds:string[])=>Promise<unknown>;
}
async function owner(workspaceSlug:string):Promise<Context|null>{
 if(operationalDatabaseMode()!=="SERVICE_ROLE")return null;
 try{
  const res=await resolveStaffActor(workspaceSlug);
  if(!res.ok)return null;
  const {workspace,actor,branchScope,service}=res.value;
  if(workspace.slug!==workspaceSlug||!uuid.test(workspace.id)||
     typeof actor.userId!=="string"||!uuid.test(actor.userId)||
     actor.role!=="OWNER"||actor.workspaceId!==workspace.id||
     branchScope.mode!=="ALL")return null;
  const branches=branchScope.branches.map(x=>x.id);
  if(!branches.length||new Set(branches).size!==branches.length||
     branches.some(x=>!uuid.test(x)))return null;
  return {workspaceId:workspace.id,actorId:actor.userId,branches,service};
 }catch{return null;}
}
async function journal(service:Pick<SupabaseClient,"from">,workspaceId:string,
 branchId:string,requestId:string):Promise<unknown>{
 const rows=await service.from("f15_unanswered_lead_reviews")
  .select("id,workspace_id,branch_id,request_id,source_version,state,recorded_at")
  .eq("workspace_id",workspaceId).eq("branch_id",branchId)
  .eq("request_id",requestId).limit(26);
 return rows.error?null:rows.data;
}
async function attention(service:Pick<SupabaseClient,"from">,workspaceId:string,
 reviewIds:string[]):Promise<unknown>{
 const rows=await service.from("attention_items")
  .select("id,workspace_id,type,resource_type,resource_id,severity,status")
  .eq("workspace_id",workspaceId).eq("type","UNANSWERED_LEAD_SLA")
  .eq("resource_type","f15_unanswered_lead_review")
  .in("resource_id",reviewIds).limit(26);
 return rows.error?null:rows.data;
}
/** OWNER-only exact source-review -> Attention Center proof.
 * Requires independent post-read authorization; never exposes IDs, names,
 * customer messages or a claim of external workflow execution. Missing
 * V3 installation cannot appear as an empty successful attention list. */
export async function readF15OwnerLinkedAttentionProof(
 workspaceSlug:string,branchId:string,requestId:string,
 deps:F15AttentionProofDeps={},
):Promise<F15AttentionProof>{
 const denied: F15AttentionProof={state:"UNAVAILABLE"};
 if(typeof workspaceSlug!=="string"||workspaceSlug.length<3||
    workspaceSlug.length>40||!slug.test(workspaceSlug)||
    !uuid.test(branchId)||!uuid.test(requestId)||branchId===requestId)return denied;
 try{
  const first=await (deps.resolve??owner)(workspaceSlug);
  if(!first||!uuid.test(first.workspaceId)||!uuid.test(first.actorId)||
    !first.branches.includes(branchId)||first.workspaceId===branchId||
    first.workspaceId===requestId)return denied;
  const source=await (deps.journal??journal)(first.service,
    first.workspaceId,branchId,requestId);
  if(!Array.isArray(source)||source.length>25)return denied;
  const ids=new Set<string>();
  for(const row of source){
   if(!row||typeof row!=="object"||Array.isArray(row)||
      !uuid.test(row.id)||ids.has(row.id)||
      row.workspace_id!==first.workspaceId||row.branch_id!==branchId||
      row.request_id!==requestId||row.state!=="OWNER_REVIEW_REQUIRED"||
      !Number.isSafeInteger(row.source_version)||row.source_version<1||
      typeof row.recorded_at!=="string"||
      !Number.isFinite(Date.parse(row.recorded_at)))return denied;
   ids.add(row.id);
  }
  if(ids.size===0){
   const again=await (deps.resolve??owner)(workspaceSlug);
   if(!again||again.workspaceId!==first.workspaceId||
      again.actorId!==first.actorId||!again.branches.includes(branchId))
      return denied;
   return {state:"NO_REVIEW_RECORDED"};
  }
  const stored=await (deps.attention??attention)(first.service,
    first.workspaceId,Array.from(ids));
  if(!Array.isArray(stored)||stored.length!==ids.size)return denied;
  const found=new Set<string>();
  let open=0,acknowledged=0,resolved=0;
  for(const row of stored){
   if(!row||typeof row!=="object"||Array.isArray(row)||
      !uuid.test(row.id)||!uuid.test(row.resource_id)||
      !ids.has(row.resource_id)||found.has(row.resource_id)||
      row.workspace_id!==first.workspaceId||
      row.type!=="UNANSWERED_LEAD_SLA"||
      row.resource_type!=="f15_unanswered_lead_review"||
      row.severity!=="WARNING"||
      !["OPEN","ACKNOWLEDGED","RESOLVED"].includes(row.status))return denied;
   found.add(row.resource_id);
   if(row.status==="OPEN")open++;
   else if(row.status==="ACKNOWLEDGED")acknowledged++;
   else resolved++;
  }
  const again=await (deps.resolve??owner)(workspaceSlug);
  if(!again||again.workspaceId!==first.workspaceId||
     again.actorId!==first.actorId||!again.branches.includes(branchId))
     return denied;
  return {state:"LINKED_INTERNAL_ATTENTION_VERIFIED",count:ids.size,
   open,acknowledged,resolved,humanReviewRequired:true,
   workflowExecuted:false,customerMessaged:false};
 }catch{return denied;}
}
