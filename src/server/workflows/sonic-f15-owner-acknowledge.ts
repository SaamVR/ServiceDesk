import type {SupabaseClient} from "@supabase/supabase-js";
import {resolveStaffActor} from "@/features/operations/operational-product-runtime";
import {operationalDatabaseMode} from "@/features/auth/operational-preview-mode";

const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[0-9a-f]{12}$/i;
const slug=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
type Owner={workspaceId:string;actorId:string;branches:string[];service:Pick<SupabaseClient,"from">};
type Candidate={attentionId:string;reviewId:string;workspaceId:string;branchId:string;requestId:string};
type Lookup={state:"NONE"|"AMBIGUOUS"}|{state:"ONE";candidate:Candidate};
export type F15AcknowledgeResult={state:
  "NOT_ACTIVATED"|"UNAVAILABLE"|"NO_OPEN_REVIEW"|"AMBIGUOUS_OPEN_REVIEWS"|
  "ACKNOWLEDGED_VERIFIED";providerSent:false;workflowExecuted:false};
export interface F15AcknowledgeDeps {
 enabled?:()=>boolean;mode?:typeof operationalDatabaseMode;
 resolve?:(workspaceSlug:string)=>Promise<Owner|null>;
 find?:(service:Pick<SupabaseClient,"from">,workspaceId:string,
  branchId:string,requestId:string)=>Promise<Lookup|null>;
 commit?:(service:Pick<SupabaseClient,"from">,candidate:Candidate)=>Promise<boolean>;
 readback?:(service:Pick<SupabaseClient,"from">,candidate:Candidate)=>Promise<boolean>;
}
async function currentOwner(workspaceSlug:string):Promise<Owner|null>{
 try{
  const current=await resolveStaffActor(workspaceSlug);
  if(!current.ok)return null;
  const {actor,workspace,branchScope,service}=current.value;
  if(workspace.slug!==workspaceSlug||!uuid.test(workspace.id)||
     typeof actor.userId!=="string"||!uuid.test(actor.userId)||
     actor.role!=="OWNER"||actor.workspaceId!==workspace.id||
     branchScope.mode!=="ALL")return null;
  const branches=branchScope.branches.map(x=>x.id);
  if(!branches.length||new Set(branches).size!==branches.length||
     branches.some(b=>!uuid.test(b)))return null;
  return {workspaceId:workspace.id,actorId:actor.userId,branches,service};
 }catch{return null;}
}
async function findOneOpen(service:Pick<SupabaseClient,"from">,
 workspaceId:string,branchId:string,requestId:string):Promise<Lookup|null>{
 const r=await service.from("f15_unanswered_lead_reviews")
  .select("id,workspace_id,branch_id,request_id,state,source_version")
  .eq("workspace_id",workspaceId).eq("branch_id",branchId)
  .eq("request_id",requestId).limit(26);
 if(r.error||!Array.isArray(r.data)||r.data.length>25)return null;
 const ids=new Set<string>();
 for(const row of r.data){
  if(!uuid.test(row.id)||ids.has(row.id)||
     row.workspace_id!==workspaceId||row.branch_id!==branchId||
     row.request_id!==requestId||row.state!=="OWNER_REVIEW_REQUIRED"||
     !Number.isSafeInteger(row.source_version)||row.source_version<1)return null;
  ids.add(row.id);
 }
 if(ids.size===0)return {state:"NONE"};
 const a=await service.from("attention_items")
  .select("id,workspace_id,type,resource_type,resource_id,severity,status")
  .eq("workspace_id",workspaceId).eq("type","UNANSWERED_LEAD_SLA")
  .eq("resource_type","f15_unanswered_lead_review")
  .eq("status","OPEN").in("resource_id",Array.from(ids)).limit(2);
 if(a.error||!Array.isArray(a.data))return null;
 if(a.data.length>1)return {state:"AMBIGUOUS"};
 if(a.data.length===0)return {state:"NONE"};
 const row=a.data[0];
 if(!uuid.test(row.id)||!uuid.test(row.resource_id)||!ids.has(row.resource_id)||
    row.workspace_id!==workspaceId||row.type!=="UNANSWERED_LEAD_SLA"||
    row.resource_type!=="f15_unanswered_lead_review"||
    row.severity!=="WARNING"||row.status!=="OPEN")return null;
 return {state:"ONE",candidate:{attentionId:row.id,reviewId:row.resource_id,
  workspaceId,branchId,requestId}};
}
async function compareAndSet(service:Pick<SupabaseClient,"from">,
 c:Candidate):Promise<boolean>{
 const result=await service.from("attention_items")
  .update({status:"ACKNOWLEDGED"})
  .eq("id",c.attentionId).eq("workspace_id",c.workspaceId)
  .eq("type","UNANSWERED_LEAD_SLA")
  .eq("resource_type","f15_unanswered_lead_review")
  .eq("resource_id",c.reviewId)
  .eq("status","OPEN").select("id,workspace_id,resource_id,status").maybeSingle();
 return !result.error&&result.data?.id===c.attentionId&&
   result.data.workspace_id===c.workspaceId&&
   result.data.resource_id===c.reviewId&&result.data.status==="ACKNOWLEDGED";
}
async function checkSaved(service:Pick<SupabaseClient,"from">,
 c:Candidate):Promise<boolean>{
 const result=await service.from("attention_items")
  .select("id,workspace_id,type,resource_type,resource_id,status")
  .eq("id",c.attentionId).eq("workspace_id",c.workspaceId)
  .eq("resource_id",c.reviewId).maybeSingle();
 return !result.error&&result.data?.id===c.attentionId&&
  result.data.workspace_id===c.workspaceId&&
  result.data.resource_type==="f15_unanswered_lead_review"&&
  result.data.type==="UNANSWERED_LEAD_SLA"&&
  result.data.resource_id===c.reviewId&&result.data.status==="ACKNOWLEDGED";
}
const output=(state:F15AcknowledgeResult["state"]):F15AcknowledgeResult=>({
 state,providerSent:false,workflowExecuted:false,
});
/** One explicit human ACK of exactly one open owner review, never a send or
 * automatic rule. Trusted service-role only, off until separate DBA/owner
 * approved V3 installation and deployment switch. Do not accept browser IDs
 * for attention or review; discover both from current scoped saved records.
 */
export async function acknowledgeF15OneSavedInternalAttention(
 workspaceSlug:string,branchId:string,requestId:string,
 deps:F15AcknowledgeDeps={},
):Promise<F15AcknowledgeResult>{
 if(!(deps.enabled??(()=>process.env.SERVICEDESK_F15_OWNER_MANUAL_ESCALATION_ENABLED==="true"))())
  return output("NOT_ACTIVATED");
 if((deps.mode??operationalDatabaseMode)()!=="SERVICE_ROLE"||
    typeof workspaceSlug!=="string"||workspaceSlug.length<3||
    workspaceSlug.length>40||!slug.test(workspaceSlug)||
    !uuid.test(branchId)||!uuid.test(requestId)||branchId===requestId)
  return output("UNAVAILABLE");
 try{
  const resolve=deps.resolve??currentOwner;
  const first=await resolve(workspaceSlug);
  if(!first||!uuid.test(first.actorId)||!uuid.test(first.workspaceId)||
     !first.branches.includes(branchId)||first.workspaceId===branchId||
     first.workspaceId===requestId)return output("UNAVAILABLE");
  const found=await (deps.find??findOneOpen)(
   first.service,first.workspaceId,branchId,requestId);
  if(!found)return output("UNAVAILABLE");
  if(found.state==="NONE")return output("NO_OPEN_REVIEW");
  if(found.state==="AMBIGUOUS")return output("AMBIGUOUS_OPEN_REVIEWS");
  const c=found.candidate;
  if(!uuid.test(c.attentionId)||!uuid.test(c.reviewId)||
     c.workspaceId!==first.workspaceId||c.branchId!==branchId||
     c.requestId!==requestId)return output("UNAVAILABLE");
  // Reauthorize after all source reads, immediately before a compare-and-set.
  const again=await resolve(workspaceSlug);
  if(!again||again.actorId!==first.actorId||
     again.workspaceId!==first.workspaceId||
     !again.branches.includes(branchId))return output("UNAVAILABLE");
  const committed=await (deps.commit??compareAndSet)(again.service,c);
  if(!committed)return output("UNAVAILABLE");
  // The UPDATE response alone is insufficient: verify a second saved read
  // under the same exact tenant, review and action IDs.
  if(!await (deps.readback??checkSaved)(again.service,c))
   return output("UNAVAILABLE");
  return output("ACKNOWLEDGED_VERIFIED");
 }catch{return output("UNAVAILABLE");}
}
