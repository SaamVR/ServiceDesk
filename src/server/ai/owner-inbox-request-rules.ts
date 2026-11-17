import {resolveStaffActor} from "@/features/operations/operational-product-runtime";
import {runOwnerSavedRequestAutomation} from "@/server/workflows/owner-request-automation";
import {operationalDatabaseMode} from "@/features/auth/operational-preview-mode";

type Resolver=typeof resolveStaffActor;
type Runner=typeof runOwnerSavedRequestAutomation;
type Read=Extract<Awaited<ReturnType<Resolver>>,{ok:true}>;

export type F19InboxRulesResult=
 | {ok:false;code:"F19_INPUT_INVALID"|"F19_BACKEND_DISABLED"|"F19_OWNER_REQUIRED"|
   "F19_SAVED_REQUEST_UNAVAILABLE"|"F19_SOURCE_CHANGED"|"F19_RULE_EXECUTION_UNAVAILABLE"}
 | {ok:true;value:{
   state:"PERSISTED_INTERNAL_REQUEST_RULES"|"NO_INTERNAL_ATTENTION_CREATED";
   matchedRules:number;completedAttentionActions:number;
   newlyRecordedExecutions:number;reusedExecutions:number;
   externalApprovalRequired:number;sourceEventReplayed:boolean;
   persistedInternalAttentionVerified:boolean;externalMessagesSent:0;
   customerMessageSent:false;moneyChanged:false;automaticSlaEventCreated:false;
   ownerTriggered:true;
 }};
export interface F19InboxRulesDeps{
 resolveActor?:Resolver;executeRequest?:Runner;mode?:typeof operationalDatabaseMode;
}
const uuid=(v:unknown):v is string=>typeof v==="string"&&
 /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v);
const slug=(v:unknown):v is string=>typeof v==="string"&&
 v.length>=3&&v.length<=40&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v);
const deny=(code:Extract<F19InboxRulesResult,{ok:false}>["code"]):F19InboxRulesResult=>({ok:false,code});
function owner(input:Awaited<ReturnType<Resolver>>,slugValue:string):input is Read{
 return input.ok&&input.value.workspace.slug===slugValue&&
  uuid(input.value.workspace.id)&&uuid(input.value.actor.userId)&&
  input.value.actor.role==="OWNER"&&
  input.value.actor.workspaceId===input.value.workspace.id&&
  input.value.branchScope.mode==="ALL";
}
async function loadLink(actor:Read["value"],conversationId:string):Promise<{
 requestId:string;branchId:string;fingerprint:string;
}|null>{
 const {workspace,service,branchScope}=actor;
 const conv=await service.from("conversations")
  .select("id,workspace_id,branch_id,request_id,customer_id,version")
  .eq("id",conversationId).eq("workspace_id",workspace.id).maybeSingle();
 if(conv.error||!conv.data||conv.data.id!==conversationId||
    !uuid(conv.data.request_id)||!uuid(conv.data.branch_id)||
    !Number.isSafeInteger(conv.data.version)||conv.data.version<1||
    !branchScope.branches.some(b=>b.id===conv.data?.branch_id))return null;
 const c=conv.data;
 const req=await service.from("requests")
  .select("id,workspace_id,branch_id,customer_id,version,status")
  .eq("id",c.request_id).eq("workspace_id",workspace.id).maybeSingle();
 if(req.error||!req.data||req.data.id!==c.request_id||
    req.data.branch_id!==c.branch_id||req.data.customer_id!==c.customer_id||
    !Number.isSafeInteger(req.data.version)||req.data.version<1||
    !["NEW","COLLECTING","READY","NEEDS_REVIEW","QUOTED","BOOKED"].includes(req.data.status))
   return null;
 const r=req.data;
 return {requestId:r.id,branchId:r.branch_id,
  fingerprint:JSON.stringify([c.id,c.workspace_id,c.branch_id,c.request_id,
    c.customer_id,c.version,r.id,r.workspace_id,r.branch_id,
    r.customer_id,r.version,r.status])};
}
/**
 * Explicit OWNER click in Inbox processes the EXISTING REQUEST_CREATED rules,
 * never creates an unanswered-lead SLA source event. Its protected workflow
 * implementation handles persisted execution identity, action ledger and
 * exact attention readback; this wrapper only maps an already-saved Inbox
 * conversation to a reauthorized request, never trusts browser request IDs.
 */
export async function processOwnerInboxRequestRules(
 workspaceSlug:string,conversationId:string,deps:F19InboxRulesDeps={},
):Promise<F19InboxRulesResult>{
 if(!slug(workspaceSlug)||!uuid(conversationId))return deny("F19_INPUT_INVALID");
 if((deps.mode??operationalDatabaseMode)()!=="SERVICE_ROLE")
  return deny("F19_BACKEND_DISABLED");
 const resolve=deps.resolveActor??resolveStaffActor;
 let first:Awaited<ReturnType<Resolver>>;
 try{first=await resolve(workspaceSlug);}catch{return deny("F19_OWNER_REQUIRED");}
 if(!owner(first,workspaceSlug))return deny("F19_OWNER_REQUIRED");
 let a:Awaited<ReturnType<typeof loadLink>>;
 try{a=await loadLink(first.value,conversationId);}
 catch{return deny("F19_SAVED_REQUEST_UNAVAILABLE");}
 if(!a)return deny("F19_SAVED_REQUEST_UNAVAILABLE");
 let second:Awaited<ReturnType<Resolver>>;
 try{second=await resolve(workspaceSlug);}catch{return deny("F19_SOURCE_CHANGED");}
 if(!owner(second,workspaceSlug)||second.value.workspace.id!==first.value.workspace.id||
    second.value.actor.userId!==first.value.actor.userId||
    !second.value.branchScope.branches.some(b=>b.id===a?.branchId))
   return deny("F19_SOURCE_CHANGED");
 let b:Awaited<ReturnType<typeof loadLink>>;
 try{b=await loadLink(second.value,conversationId);}
 catch{return deny("F19_SOURCE_CHANGED");}
 if(!b||b.fingerprint!==a.fingerprint||b.requestId!==a.requestId)
  return deny("F19_SOURCE_CHANGED");
 // The existing executor performs a third OWNER/tenant/branch authorization,
 // reads the actual active published rules and verifies attention receipts.
 let result:Awaited<ReturnType<Runner>>;
 try{result=await (deps.executeRequest??runOwnerSavedRequestAutomation)(workspaceSlug,a.requestId);}
 catch{return deny("F19_RULE_EXECUTION_UNAVAILABLE");}
 if(!result.ok)return deny("F19_RULE_EXECUTION_UNAVAILABLE");
 const v=result.value;
 const valid=(n:unknown)=>typeof n==="number"&&Number.isSafeInteger(n)&&n>=0&&n<=512;
 if(v.state!=="PERSISTED_INTERNAL_WORKFLOW_PROCESSING"||
    v.requestId!==a.requestId||v.providerMessagesSent!==0||
    !valid(v.matchedExecutions)||!valid(v.completedAttentionActions)||
    !valid(v.externalApprovalRequired)||!valid(v.newlyRecordedRuleExecutions)||
    !valid(v.reusedRuleExecutions)||
    v.newlyRecordedRuleExecutions+v.reusedRuleExecutions>64||
    v.matchedExecutions>v.newlyRecordedRuleExecutions+v.reusedRuleExecutions||
    v.matchedExecutions>64||
    v.completedAttentionActions>v.matchedExecutions*6||
    v.externalApprovalRequired>v.matchedExecutions*6||
    typeof v.replayedSourceEvent!=="boolean")return deny("F19_RULE_EXECUTION_UNAVAILABLE");
 return {ok:true,value:{
  state:v.completedAttentionActions>0?"PERSISTED_INTERNAL_REQUEST_RULES":
    "NO_INTERNAL_ATTENTION_CREATED",
  matchedRules:v.matchedExecutions,
  completedAttentionActions:v.completedAttentionActions,
  newlyRecordedExecutions:v.newlyRecordedRuleExecutions,
  reusedExecutions:v.reusedRuleExecutions,
  externalApprovalRequired:v.externalApprovalRequired,
  sourceEventReplayed:v.replayedSourceEvent,
  persistedInternalAttentionVerified:v.completedAttentionActions>0,
  externalMessagesSent:0,customerMessageSent:false,moneyChanged:false,
  automaticSlaEventCreated:false,ownerTriggered:true,
 }};
}
