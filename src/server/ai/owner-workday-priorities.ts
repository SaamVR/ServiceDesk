import {resolveStaffActor,loadOperationalStaffSnapshot} from "@/features/operations/operational-product-runtime";
import {deriveOwnerOperationsBriefFacts,isFreshOwnerOperationsSnapshotAt,
  type OwnerOperationsBriefFacts} from "./owner-operations-brief";
import {ownerPriorityActions,type OwnerPriorityAction} from "./owner-priority-actions";
import {planOwnerAttentionSla,type OwnerAttentionSlaResult} from "./owner-attention-sla";

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
      attentionSla:Extract<OwnerAttentionSlaResult,{ok:true}>["value"];
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

/** An aggregate may remain identical after two requests or quote IDs swap.
 * Compare only the saved, non-customer fields capable of invalidating the
 * workday review. Never serialize notes, contact, address, invoice line items
 * or provider response bodies to an AI model or outward receipt.
 */
const sourceColumns={
 requests:["id","workspaceId","branchId","status","serviceCode","version","updatedAt","createdAt"],
 quotes:["id","workspaceId","requestId","branchId","status","version","validUntil","expiresAt","acceptedAt","updatedAt"],
 invoices:["id","workspaceId","quoteId","status","state","version","paidMinor","balanceDueMinor","updatedAt"],
 visits:["id","workspaceId","branchId","status","crewId","assignedCrewId","scheduledAt","updatedAt"],
 attentionItems:["id","workspaceId","status","severity","type","resourceId","dueAt","updatedAt"],
} as const;
function sourceIdentity(snapshot:Pick<Awaited<ReturnType<Loader>> extends {ok:true;value:infer V}?V:never,
  "requests"|"quotes"|"visits"|"invoices"|"attentionItems">):string|null {
 try{
  const out:unknown[][]=[];
  for(const [name,columns] of Object.entries(sourceColumns)){
   const rows=snapshot[name as keyof typeof sourceColumns];
   if(!Array.isArray(rows)||Object.getPrototypeOf(rows)!==Array.prototype||
      rows.length>5000||Reflect.ownKeys(rows).length!==rows.length+1)return null;
   const mapped:string[]=[];
   for(let i=0;i<rows.length;i++){
    const entry=Object.getOwnPropertyDescriptor(rows,String(i));
    if(!entry||!Object.hasOwn(entry,"value"))return null;
    const row:unknown=entry.value;
    if(!row||typeof row!=="object"||Array.isArray(row)||
       Object.getPrototypeOf(row)!==Object.prototype)return null;
    const descriptors=Object.getOwnPropertyDescriptors(row);
    if(Reflect.ownKeys(row).length!==Object.keys(descriptors).length ||
       Object.values(descriptors).some(d=>!Object.hasOwn(d,"value")))return null;
    const fields=columns.map(key=>{
     const d=descriptors[key];
     if(!d)return null;
     const v=d.value;
     return v===null||typeof v==="string"||typeof v==="number"||
       typeof v==="boolean"?v:null;
    });
    mapped.push(JSON.stringify(fields));
   }
   out.push([name,...mapped.sort()]);
  }
  return JSON.stringify(out);
 }catch{return null;}
}

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
  // Persisted source adapters can fail unexpectedly while projecting a
  // saved row. A broken/poisoned snapshot must never crash the owner panel.
  let facts:ReturnType<typeof deriveOwnerOperationsBriefFacts>;
  try{facts=deriveOwnerOperationsBriefFacts(saved.value);}
  catch{return {ok:false,code:"WORKDAY_SNAPSHOT_UNAVAILABLE"};}
  if(!facts)return {ok:false,code:"WORKDAY_SNAPSHOT_UNAVAILABLE"};
  const firstSourceIdentity=sourceIdentity(saved.value);
  if(firstSourceIdentity===null)return {ok:false,code:"WORKDAY_SNAPSHOT_UNAVAILABLE"};
  const sourceSla=planOwnerAttentionSla({
    workspaceId,actor:saved.value.actor,now:saved.value.loadedAt,
    attentionItems:saved.value.attentionItems,
  });
  if(!sourceSla.ok)return {ok:false,code:"WORKDAY_SNAPSHOT_UNAVAILABLE"};
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
  let freshFacts:ReturnType<typeof deriveOwnerOperationsBriefFacts>;
  try{freshFacts=deriveOwnerOperationsBriefFacts(latest.value);}
  catch{return {ok:false,code:"WORKDAY_SOURCE_CHANGED"};}
  if(!freshFacts || !sameFacts(facts,freshFacts) ||
      sourceIdentity(latest.value)!==firstSourceIdentity)
    return {ok:false,code:"WORKDAY_SOURCE_CHANGED"};
  const latestSla=planOwnerAttentionSla({
    workspaceId,actor:latest.value.actor,now:latest.value.loadedAt,
    attentionItems:latest.value.attentionItems,
  });
  if(!latestSla.ok||JSON.stringify(sourceSla.value)!==JSON.stringify(latestSla.value))
    return {ok:false,code:"WORKDAY_SOURCE_CHANGED"};
  const priorities=ownerPriorityActions(freshFacts,7);
  if(!priorities)return {ok:false,code:"WORKDAY_SOURCE_CHANGED"};
  if(deps.signal?.aborted)return {ok:false,code:"WORKDAY_CANCELLED"};
  return {ok:true,value:{
    state:"VERIFIED_OWNER_WORKDAY_REVIEW",
    source:"DOUBLE_CHECKED_SAVED_WORKSPACE_COUNTS",
    workspaceId,facts:freshFacts,priorities,attentionSla:latestSla.value,
    manualReviewRequired:true,modelInvoked:false,
    providerMessageSent:false,paymentChanged:false,
  }};
}
