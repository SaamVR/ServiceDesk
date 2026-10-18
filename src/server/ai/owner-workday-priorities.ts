import {resolveStaffActor,loadOperationalStaffSnapshot} from "@/features/operations/operational-product-runtime";
import {deriveOwnerOperationsBriefFacts,isFreshOwnerOperationsSnapshotAt,
  type OwnerOperationsBriefFacts} from "./owner-operations-brief";
import {ownerPriorityActions,type OwnerPriorityAction} from "./owner-priority-actions";

type Resolver=typeof resolveStaffActor;
type Loader=typeof loadOperationalStaffSnapshot;
export interface OwnerWorkdayDependencies {
  resolveActor?:Resolver;loadSnapshot?:Loader;now?:()=>number;
  signal?:AbortSignal;
}
export type OwnerWorkdayResult=
  | {ok:false;code:"WORKDAY_INPUT_INVALID"|"WORKDAY_OWNER_REQUIRED"|
      "WORKDAY_SNAPSHOT_UNAVAILABLE"|"WORKDAY_SOURCE_CHANGED"|"WORKDAY_CANCELLED"}
  | {ok:true;value:{
      state:"VERIFIED_OWNER_WORKDAY_REVIEW";
      source:"DOUBLE_CHECKED_SAVED_WORKSPACE_COUNTS";
      workspaceId:string;
      facts:OwnerOperationsBriefFacts;
      priorities:OwnerPriorityAction[];
      manualReviewRequired:true;
      modelInvoked:false;
      providerMessageSent:false;paymentChanged:false;
    }};

const validSlug=(s:unknown)=>typeof s==="string" &&
  s.length>=3 && s.length<=40 &&
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s);
function verifiedOwner(result:Awaited<ReturnType<Resolver>>,slug:string):boolean{
  return result.ok && result.value.workspace.slug===slug &&
    result.value.workspace.id===result.value.actor.workspaceId &&
    result.value.actor.role==="OWNER" &&
    typeof result.value.actor.userId==="string" &&
    result.value.actor.userId.length>0;
}
const sameFacts=(a:OwnerOperationsBriefFacts,b:OwnerOperationsBriefFacts)=>
  (Object.keys(a) as Array<keyof OwnerOperationsBriefFacts>).every(k=>a[k]===b[k]);

/** An actual authenticated server-side owner workday entrypoint. Unlike the
 * generative owner AI brief, it remains usable with all AI provider flags off.
 * AI cannot invent counts or prevent access to verified saved queues. */
export async function loadOwnerWorkdayPriorities(
  slug:string,deps:OwnerWorkdayDependencies={},
):Promise<OwnerWorkdayResult>{
  if(!validSlug(slug))return {ok:false,code:"WORKDAY_INPUT_INVALID"};
  if(deps.signal?.aborted)return {ok:false,code:"WORKDAY_CANCELLED"};
  const resolve=deps.resolveActor??resolveStaffActor;
  const load=deps.loadSnapshot??loadOperationalStaffSnapshot;
  const now=deps.now??Date.now;
  let first:Awaited<ReturnType<Resolver>>;
  try{first=await resolve(slug);}catch{return {ok:false,code:"WORKDAY_OWNER_REQUIRED"};}
  if(!verifiedOwner(first,slug))return {ok:false,code:"WORKDAY_OWNER_REQUIRED"};
  if(!first.ok)return {ok:false,code:"WORKDAY_OWNER_REQUIRED"};
  const workspaceId=first.value.workspace.id,userId=first.value.actor.userId;
  let saved:Awaited<ReturnType<Loader>>;
  try{saved=await load(slug);}catch{return {ok:false,code:"WORKDAY_SNAPSHOT_UNAVAILABLE"};}
  if(!saved.ok || saved.value.workspace.id!==workspaceId ||
      saved.value.actor.workspaceId!==workspaceId ||
      saved.value.actor.userId!==userId ||
      saved.value.actor.role!=="OWNER" ||
      !isFreshOwnerOperationsSnapshotAt(saved.value.loadedAt,now()))
    return {ok:false,code:"WORKDAY_SNAPSHOT_UNAVAILABLE"};
  const facts=deriveOwnerOperationsBriefFacts(saved.value);
  if(!facts)return {ok:false,code:"WORKDAY_SNAPSHOT_UNAVAILABLE"};
  if(deps.signal?.aborted)return {ok:false,code:"WORKDAY_CANCELLED"};
  let second:Awaited<ReturnType<Resolver>>;
  let latest:Awaited<ReturnType<Loader>>;
  try {
    second=await resolve(slug);
    if(!verifiedOwner(second,slug) || !second.ok ||
       second.value.workspace.id!==workspaceId ||
       second.value.actor.userId!==userId)
      return {ok:false,code:"WORKDAY_OWNER_REQUIRED"};
    latest=await load(slug);
  }catch{return {ok:false,code:"WORKDAY_SOURCE_CHANGED"};}
  if(!latest.ok || latest.value.workspace.id!==workspaceId ||
      latest.value.actor.workspaceId!==workspaceId ||
      latest.value.actor.userId!==userId || latest.value.actor.role!=="OWNER" ||
      !isFreshOwnerOperationsSnapshotAt(latest.value.loadedAt,now()))
    return {ok:false,code:"WORKDAY_SOURCE_CHANGED"};
  const freshFacts=deriveOwnerOperationsBriefFacts(latest.value);
  if(!freshFacts || !sameFacts(facts,freshFacts))
    return {ok:false,code:"WORKDAY_SOURCE_CHANGED"};
  const priorities=ownerPriorityActions(freshFacts,7);
  if(!priorities)return {ok:false,code:"WORKDAY_SOURCE_CHANGED"};
  if(deps.signal?.aborted)return {ok:false,code:"WORKDAY_CANCELLED"};
  return {ok:true,value:{
    state:"VERIFIED_OWNER_WORKDAY_REVIEW",
    source:"DOUBLE_CHECKED_SAVED_WORKSPACE_COUNTS",
    workspaceId,facts:freshFacts,priorities,
    manualReviewRequired:true,modelInvoked:false,
    providerMessageSent:false,paymentChanged:false,
  }};
}
