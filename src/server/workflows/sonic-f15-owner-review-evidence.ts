import type {SupabaseClient} from "@supabase/supabase-js";
import {resolveStaffActor} from "@/features/operations/operational-product-runtime";
import {operationalDatabaseMode} from "@/features/auth/operational-preview-mode";

const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[0-9a-f]{12}$/i;
const slugPattern=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
type Owner={workspaceId:string;branchIds:string[];service:Pick<SupabaseClient,"from">};
export type F15ReviewEvidence=
 | {state:"UNAVAILABLE"}
 | {state:"NO_REVIEW_RECORDED";count:0}
 | {state:"SAVED_OWNER_REVIEW_CONFIRMED";count:number;latestAt:string;
    humanApprovalRequired:true;workflowExecuted:false;customerMessaged:false};
export interface F15EvidenceDeps {
 resolveOwner?:(slug:string)=>Promise<Owner|null>;
 readRows?:(service:Pick<SupabaseClient,"from">,workspaceId:string,
  branchId:string,requestId:string)=>Promise<unknown>;
}
async function owner(slug:string):Promise<Owner|null>{
 if(operationalDatabaseMode()!=="SERVICE_ROLE")return null;
 try{
  const found=await resolveStaffActor(slug);
  if(!found.ok)return null;
  const {workspace,actor,branchScope,service}=found.value;
  if(workspace.slug!==slug||!uuid.test(workspace.id)||
     typeof actor.userId!=="string"||!uuid.test(actor.userId)||
     actor.role!=="OWNER"||actor.workspaceId!==workspace.id||
     branchScope.mode!=="ALL")return null;
  const branchIds=branchScope.branches.map(x=>x.id);
  if(!branchIds.length||branchIds.some(x=>!uuid.test(x)))return null;
  return {workspaceId:workspace.id,branchIds,service};
 }catch{return null;}
}
async function fromDatabase(
 service:Pick<SupabaseClient,"from">,workspaceId:string,branchId:string,requestId:string,
):Promise<unknown>{
 const response=await service.from("f15_unanswered_lead_reviews")
  .select("workspace_id,branch_id,request_id,source_version,state,recorded_at")
  .eq("workspace_id",workspaceId).eq("branch_id",branchId)
  .eq("request_id",requestId)
  .order("recorded_at",{ascending:false}).limit(26);
 if(response.error)return null;
 return response.data;
}
/** Independently read back genuine persisted F15 journal rows, including
 * after process restart. No PII, message text, event ID or raw event key
 * leaves the server. An uninstalled journal or partial read fails CLOSED. */
export async function readF15OwnerSavedReviewEvidence(
 workspaceSlug:string,branchId:string,requestId:string,
 deps:F15EvidenceDeps={},
):Promise<F15ReviewEvidence>{
 const unavailable: F15ReviewEvidence={state:"UNAVAILABLE"};
 if(typeof workspaceSlug!=="string"||workspaceSlug.length<3||
    workspaceSlug.length>40||!slugPattern.test(workspaceSlug)||
    !uuid.test(branchId)||!uuid.test(requestId)||branchId===requestId)return unavailable;
 try{
  const a=await (deps.resolveOwner??owner)(workspaceSlug);
  if(!a||!uuid.test(a.workspaceId)||a.workspaceId===branchId||
     a.workspaceId===requestId||!a.branchIds.includes(branchId))return unavailable;
  const raw=await (deps.readRows??fromDatabase)(
   a.service,a.workspaceId,branchId,requestId);
  if(!Array.isArray(raw)||raw.length>25)return unavailable;
  for(const row of raw){
   if(!row||typeof row!=="object"||Array.isArray(row)||
      row.workspace_id!==a.workspaceId||row.branch_id!==branchId||
      row.request_id!==requestId||row.state!=="OWNER_REVIEW_REQUIRED"||
      !Number.isSafeInteger(row.source_version)||row.source_version<1||
      typeof row.recorded_at!=="string"||
      !Number.isFinite(Date.parse(row.recorded_at)))return unavailable;
  }
  if(raw.length===0)return {state:"NO_REVIEW_RECORDED",count:0};
  const latest=raw.map(x=>x.recorded_at as string)
   .sort((a,b)=>Date.parse(b)-Date.parse(a))[0];
  return {state:"SAVED_OWNER_REVIEW_CONFIRMED",count:raw.length,
   latestAt:latest,humanApprovalRequired:true,
   workflowExecuted:false,customerMessaged:false};
 }catch{return unavailable;}
}
