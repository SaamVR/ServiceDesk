import type {SupabaseClient} from "@supabase/supabase-js";
import type {SupabaseRpcClient} from "@/server/core/payment-application-postgres";
import {resolveStaffActor} from "@/features/operations/operational-product-runtime";
import {operationalDatabaseMode} from "@/features/auth/operational-preview-mode";
import {readF15CompleteSavedLeadFacts} from "./sonic-f15-complete-saved-source";
import {ingestF15UnansweredLeadCandidate,type F15AtomicIngressPort}
 from "./sonic-f15-atomic-ingress";
import {PostgresF15AtomicIngressPort} from "./sonic-f15-postgres-port";

const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[0-9a-f]{12}$/i;
const slug=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export type F15OwnerEscalationResult=
 | {state:"NOT_ACTIVATED"|"UNAVAILABLE"|"NOT_DUE"}
 | {state:"OWNER_REVIEW_RECORDED"|"ALREADY_RECORDED";
    durableInternalReview:true;workflowExecuted:false;
    customerMessaged:false;paymentChanged:false;modelInvoked:false};

type TrustedOwner={
 workspaceId:string;userId:string;branchIds:string[];
 service:Pick<SupabaseClient,"from">;rpc:SupabaseRpcClient;
};
/** This function is not an exposed API and never accepts an owner or
 * workspace identity from the browser. It checks active session membership
 * independently on each action. */
async function verifiedOwner(workspaceSlug:string):Promise<TrustedOwner|null>{
 if(operationalDatabaseMode()!=="SERVICE_ROLE")return null;
 try{
  const x=await resolveStaffActor(workspaceSlug);
  if(!x.ok)return null;
  const {actor,workspace,branchScope,service,rpc}=x.value;
  const actorId=actor.userId;
  if(actor.role!=="OWNER"||actor.workspaceId!==workspace.id||
     typeof actorId!=="string"||!uuid.test(actorId)||!uuid.test(workspace.id)||
     workspace.slug!==workspaceSlug||branchScope.mode!=="ALL")return null;
  const branchIds=branchScope.branches.map(b=>b.id);
  if(!branchIds.length||new Set(branchIds).size!==branchIds.length||
     branchIds.some(b=>!uuid.test(b)))return null;
  return {workspaceId:workspace.id,userId:actorId,branchIds,service,rpc};
 }catch{return null;}
}
export interface F15OwnerEscalationDependencies {
 enabled?:()=>boolean;
 owner?:typeof verifiedOwner;
 loadFacts?:typeof readF15CompleteSavedLeadFacts;
 ingest?:typeof ingestF15UnansweredLeadCandidate;
 port?: (rpc:SupabaseRpcClient)=>F15AtomicIngressPort;
 now?:()=>string;
}
/**
 * Owner explicitly reviews an INBOUND customer lead. Real source facts come
 * only from scoped complete saved message history; the SQL 0063-independent
 * F15 candidate function must be installed with explicit DBA approval
 * before this can commit. Deployment is off by default and no scheduler or
 * customer-message port exists. The RPC itself rechecks facts under lock.
 */
export async function runF15OwnerManualEscalation(
 workspaceSlug:string,branchId:string,requestId:string,
 deps:F15OwnerEscalationDependencies={},
):Promise<F15OwnerEscalationResult>{
 if(!(deps.enabled??(()=>process.env.SERVICEDESK_F15_OWNER_MANUAL_ESCALATION_ENABLED==="true"))())
   return {state:"NOT_ACTIVATED"};
 if(typeof workspaceSlug!=="string"||workspaceSlug.length<3||
    workspaceSlug.length>40||!slug.test(workspaceSlug)||
    !uuid.test(branchId)||!uuid.test(requestId))return {state:"UNAVAILABLE"};
 try{
  const context=await (deps.owner??verifiedOwner)(workspaceSlug);
  if(!context||!uuid.test(context.workspaceId)||!uuid.test(context.userId)||
     !Array.isArray(context.branchIds)||!context.branchIds.includes(branchId)||
     context.workspaceId===branchId||context.workspaceId===requestId||
     branchId===requestId)return {state:"UNAVAILABLE"};
  const facts=await (deps.loadFacts??readF15CompleteSavedLeadFacts)(
    context.service,context.workspaceId,branchId,requestId);
  if(!facts||facts.workspaceId!==context.workspaceId||
     facts.branchId!==branchId||facts.requestId!==requestId||
     facts.responseHistoryComplete!==true)return {state:"UNAVAILABLE"};
  const observedAt=(deps.now??(()=>new Date().toISOString()))();
  if(typeof observedAt!=="string"||!Number.isFinite(Date.parse(observedAt)))
    return {state:"UNAVAILABLE"};
  const port=(deps.port??(rpc=>new PostgresF15AtomicIngressPort(rpc)))(context.rpc);
  const receipt=await (deps.ingest??ingestF15UnansweredLeadCandidate)({
   record:facts,observedAt,thresholdMinutes:60,
  },port);
  if(!receipt.ok)return {state:receipt.code==="F15_NOT_DUE"?"NOT_DUE":"UNAVAILABLE"};
  if(receipt.value.ownerApprovalStillRequired!==true||
     receipt.value.durableEventRecorded!==true||
     receipt.value.workflowExecuted!==false||
     receipt.value.providerCalled!==false||
     receipt.value.customerMessageSent!==false||
     receipt.value.moneyChanged!==false)return {state:"UNAVAILABLE"};
  return {state:receipt.value.duplicate?"ALREADY_RECORDED":"OWNER_REVIEW_RECORDED",
   durableInternalReview:true,workflowExecuted:false,customerMessaged:false,
   paymentChanged:false,modelInvoked:false};
 }catch{return {state:"UNAVAILABLE"};}
}
