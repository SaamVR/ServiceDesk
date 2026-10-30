import {resolveStaffActor} from "@/features/operations/operational-product-runtime";
import {planF15UnansweredLeadSla} from "@/server/workflows/sonic-f15-unanswered-lead-sla";
import type {F15SavedLeadFacts} from "@/server/workflows/sonic-f15-unanswered-lead-sla";

type Resolver=typeof resolveStaffActor;
type Resolved=Extract<Awaited<ReturnType<Resolver>>,{ok:true}>["value"];
type Service=Resolved["service"];

export type F15InboxSlaReview=
 | {ok:false;code:"F15_REVIEW_INVALID"|"F15_REVIEW_OWNER_REQUIRED"|"F15_REVIEW_SOURCE_UNAVAILABLE"|
   "F15_REVIEW_SOURCE_INCOMPLETE"|"F15_REVIEW_SOURCE_CHANGED"}
 | {ok:true;value:{
   state:"SAVED_INBOX_LEAD_OVERDUE_REVIEW"|"SAVED_INBOX_LEAD_NO_ESCALATION_DUE";
   source:"TWO_OWNER_AUTHORIZED_REQUEST_AND_MESSAGE_READS";
   requestId:string;conversationId:string;channel:"WEB"|"EMAIL"|"WHATSAPP";
   dueAt:string;thresholdMinutes:number;sourceVersion:number;
   staffReviewRequired:true;eventRecorded:false;externalMessageQueued:false;
   customerMessageSent:false;providerInvoked:false;modelInvoked:false;moneyChanged:false;
 }};
type ReadResult={record:F15SavedLeadFacts;conversationId:string;channel:"WEB"|"EMAIL"|"WHATSAPP";
  sourceFingerprint:string};
type Reader=(service:Service,workspaceId:string,conversationId:string)=>Promise<ReadResult|null>;
export interface F15InboxSlaDeps {
 resolveActor?:Resolver;readSource?:Reader;now?:()=>number;
}
const uuid=(v:unknown):v is string=>typeof v==="string"&&
 /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v);
const slugOk=(v:unknown):v is string=>typeof v==="string"&&
 v.length>=3&&v.length<=40&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v);
const deny=(code:Extract<F15InboxSlaReview,{ok:false}>["code"]):F15InboxSlaReview=>({ok:false,code});
function owner(r:Awaited<ReturnType<Resolver>>,slug:string):r is Extract<Awaited<ReturnType<Resolver>>,{ok:true}> {
 return r.ok&&r.value.workspace.slug===slug&&uuid(r.value.workspace.id)&&
  r.value.actor.workspaceId===r.value.workspace.id&&uuid(r.value.actor.userId)&&
  r.value.actor.role==="OWNER"&&r.value.branchScope.mode==="ALL";
}
/** The database is the source: never infer a missing staff reply from a
 * truncated, page-sized browser Inbox snapshot. Limit source cardinality so
 * multi-thread and ambiguous customer history fail closed. */
async function readSavedLead(service:Service,workspaceId:string,conversationId:string):Promise<ReadResult|null>{
 const conv=await service.from("conversations")
  .select("id,workspace_id,branch_id,request_id,customer_id,channel,version")
  .eq("id",conversationId).eq("workspace_id",workspaceId).maybeSingle();
 if(conv.error||!conv.data||conv.data.id!==conversationId||
    !uuid(conv.data.branch_id)||!uuid(conv.data.request_id)||
    !["WEB","EMAIL","WHATSAPP"].includes(conv.data.channel))return null;
 const c=conv.data;
 const request=await service.from("requests")
  .select("id,workspace_id,branch_id,customer_id,status,version,created_at")
  .eq("id",c.request_id).eq("workspace_id",workspaceId).maybeSingle();
 if(request.error||!request.data||request.data.id!==c.request_id||
    request.data.branch_id!==c.branch_id||
    request.data.customer_id!==c.customer_id||
    !Number.isSafeInteger(request.data.version)||request.data.version<1)return null;
 const r=request.data;
 // One linked request-thread, and no competing customer conversations:
 // only then does querying a single thread prove complete response history.
 const linked=await service.from("conversations")
  .select("id").eq("workspace_id",workspaceId).eq("request_id",r.id).limit(2);
 if(linked.error||!Array.isArray(linked.data)||linked.data.length!==1||
   linked.data[0].id!==conversationId)return null;
 if(r.customer_id!==null){
  if(!uuid(r.customer_id))return null;
  const siblings=await service.from("conversations").select("id")
   .eq("workspace_id",workspaceId).eq("customer_id",r.customer_id).limit(2);
  if(siblings.error||!Array.isArray(siblings.data)||siblings.data.length!==1||
     siblings.data[0].id!==conversationId)return null;
 }
 const inbound=await service.from("messages").select("id,created_at")
  .eq("workspace_id",workspaceId).eq("conversation_id",conversationId)
  .eq("direction","INBOUND").eq("sender_kind","CUSTOMER")
  .order("created_at",{ascending:false}).order("id",{ascending:false})
  .limit(1).maybeSingle();
 if(inbound.error||!inbound.data||!uuid(inbound.data.id))return null;
 // ANY saved STAFF outbound after the inbound is a staff response, even
 // when provider delivery is pending/unknown. No duplicate outreach claims.
 const reply=await service.from("messages").select("id,created_at")
  .eq("workspace_id",workspaceId).eq("conversation_id",conversationId)
  .eq("direction","OUTBOUND").eq("sender_kind","STAFF")
  .order("created_at",{ascending:false}).order("id",{ascending:false})
  .limit(1).maybeSingle();
 if(reply.error||(reply.data!==null&&(!uuid(reply.data.id)||
   typeof reply.data.created_at!=="string")))return null;
 const record:F15SavedLeadFacts={
  workspaceId,branchId:r.branch_id,requestId:r.id,version:r.version,
  status:r.status,createdAt:r.created_at,
  lastInboundAt:inbound.data.created_at,lastInboundMessageId:inbound.data.id,
  lastStaffResponseAt:reply.data?.created_at??null,responseHistoryComplete:true,
 };
 return {record,conversationId,channel:c.channel,sourceFingerprint:JSON.stringify([
  c.id,c.branch_id,c.request_id,c.customer_id,c.channel,c.version,
  r.id,r.branch_id,r.customer_id,r.status,r.version,r.created_at,
  inbound.data.id,inbound.data.created_at,reply.data?.id??null,reply.data?.created_at??null,
 ])};
}
/** Real signed-in owner operation: two distinct authorization and source
 * reads, then a policy evaluation. A positive result means manual review,
 * never an installed F15 DB event or an automatic provider delivery. */
export async function loadAuthorizedF15InboxSlaReview(
 slug:string,conversationId:string,thresholdMinutes:number,deps:F15InboxSlaDeps={},
):Promise<F15InboxSlaReview>{
 if(!slugOk(slug)||!uuid(conversationId)||
  ![30,60,120].includes(thresholdMinutes))return deny("F15_REVIEW_INVALID");
 const resolve=deps.resolveActor??resolveStaffActor;
 const read=deps.readSource??readSavedLead;
 let a:Awaited<ReturnType<Resolver>>;
 try{a=await resolve(slug);}catch{return deny("F15_REVIEW_OWNER_REQUIRED");}
 if(!owner(a,slug))return deny("F15_REVIEW_OWNER_REQUIRED");
 const {workspace,actor,service,branchScope}=a.value;
 let first:ReadResult|null;
 try{first=await read(service,workspace.id,conversationId);}catch{return deny("F15_REVIEW_SOURCE_UNAVAILABLE");}
 if(!first||first.conversationId!==conversationId||
    first.record.workspaceId!==workspace.id||
    !branchScope.branches.some(b=>b.id===first?.record.branchId))
   return deny("F15_REVIEW_SOURCE_INCOMPLETE");
 const now=(deps.now??Date.now)();
 if(!Number.isFinite(now))return deny("F15_REVIEW_SOURCE_UNAVAILABLE");
 const firstDecision=planF15UnansweredLeadSla({
  record:first.record,observedAt:new Date(now).toISOString(),thresholdMinutes,
 });
 if(!firstDecision.ok)return deny("F15_REVIEW_SOURCE_INCOMPLETE");
 let b:Awaited<ReturnType<Resolver>>;
 try{b=await resolve(slug);}catch{return deny("F15_REVIEW_SOURCE_CHANGED");}
 if(!owner(b,slug)||b.value.workspace.id!==workspace.id||
    b.value.actor.userId!==actor.userId||
    !b.value.branchScope.branches.some(x=>x.id===first?.record.branchId))
   return deny("F15_REVIEW_SOURCE_CHANGED");
 let second:ReadResult|null;
 try{second=await read(b.value.service,workspace.id,conversationId);}catch{
  return deny("F15_REVIEW_SOURCE_CHANGED");
 }
 if(!second||second.conversationId!==conversationId||
    second.record.workspaceId!==workspace.id||
    second.sourceFingerprint!==first.sourceFingerprint||
    JSON.stringify(second.record)!==JSON.stringify(first.record))
   return deny("F15_REVIEW_SOURCE_CHANGED");
 const decision=planF15UnansweredLeadSla({
  record:second.record,observedAt:new Date(now).toISOString(),thresholdMinutes,
 });
 if(!decision.ok||JSON.stringify(decision)!==JSON.stringify(firstDecision))
   return deny("F15_REVIEW_SOURCE_CHANGED");
 return {ok:true,value:{
  state:decision.value.state==="UNPERSISTED_SLA_CANDIDATE"?
   "SAVED_INBOX_LEAD_OVERDUE_REVIEW":"SAVED_INBOX_LEAD_NO_ESCALATION_DUE",
  source:"TWO_OWNER_AUTHORIZED_REQUEST_AND_MESSAGE_READS",
  requestId:second.record.requestId,conversationId,channel:second.channel,
  dueAt:decision.value.dueAt,thresholdMinutes,sourceVersion:second.record.version,
  staffReviewRequired:true,eventRecorded:false,externalMessageQueued:false,
  customerMessageSent:false,providerInvoked:false,modelInvoked:false,moneyChanged:false,
 }};
}
