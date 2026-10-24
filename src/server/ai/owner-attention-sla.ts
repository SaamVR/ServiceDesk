import type {OperationalAttention} from "@/features/operations/operational-product-runtime";
/** Saved OperationalAttention rows inherit tenant scope from the trusted loader. */
type ScopedAttention=OperationalAttention & {workspaceId?:string};
import {loadOperationalStaffSnapshot} from "@/features/operations/operational-product-runtime";
import {isFreshOwnerOperationsSnapshotAt} from "./owner-operations-brief";
import {trustedQuoteInstant} from "@/features/operations/quote-validity-clock";

type Loader=typeof loadOperationalStaffSnapshot;
type Alert={attentionId:string;severity:"INFO"|"WARNING"|"CRITICAL";dueAt:string;
  status:"OPEN"|"ACKNOWLEDGED";overdueMinutes:number;ownerReviewRequired:true};
export type OwnerAttentionSlaResult=
 | {ok:false;code:"ATTENTION_OWNER_REQUIRED"|"ATTENTION_SOURCE_UNVERIFIED"|"ATTENTION_SOURCE_CHANGED"|"ATTENTION_CANCELLED"}
 | {ok:true;value:{state:"SAVED_ATTENTION_SLA_OWNER_REVIEW";source:"DOUBLE_CHECKED_SAVED_ATTENTION_ROWS";
   workspaceId:string;inspected:number;overdueCount:number;unscheduledCount:number;
   overdue:Alert[];ownerReviewRequired:true;modelInvoked:false;customerMessaged:false;workflowExecuted:false;}};
export interface AttentionSlaSource{
  workspaceId:string;actor:{workspaceId:string;role:string};now:string;
  attentionItems:readonly ScopedAttention[];
}
export interface OwnerAttentionSlaDeps{loadSnapshot?:Loader;now?:()=>number;signal?:AbortSignal}
const validId=(v:unknown):v is string=>typeof v==="string"&&/^[A-Za-z0-9:_-]{3,128}$/.test(v);
/** Snapshot inert source rows before prioritization. No getters, proxy
 * iterators, symbolic sidecars or in-place mutations from external adapters.
 */
function captureAttention(source:unknown):ScopedAttention[]|null{
 try{
  if(!Array.isArray(source)||Object.getPrototypeOf(source)!==Array.prototype)
   return null;
  const length=Object.getOwnPropertyDescriptor(source,"length")?.value;
  if(!Number.isSafeInteger(length)||length>=5000||
     Reflect.ownKeys(source).length!==length+1)return null;
  const arrayDescriptors=Object.getOwnPropertyDescriptors(source);
  const copied:ScopedAttention[]=[];
  for(let i=0;i<length;i++){
   const item=arrayDescriptors[String(i)];
   if(!item||!Object.hasOwn(item,"value"))return null;
   const original:unknown=item.value;
   if(!original||typeof original!=="object"||Array.isArray(original)||
      Object.getPrototypeOf(original)!==Object.prototype)return null;
   const descriptors=Object.getOwnPropertyDescriptors(original);
   if(Reflect.ownKeys(original).length!==Object.keys(descriptors).length ||
      Object.values(descriptors).some(d=>!Object.hasOwn(d,"value")))return null;
   const copy:Record<string,unknown>=Object.create(null);
   for(const [key,descriptor] of Object.entries(descriptors))
    Object.defineProperty(copy,key,{
      value:descriptor.value,enumerable:true,configurable:false,writable:false,
    });
   // Descriptors above are inert; shape and tenant-scope validation still
   // occur below before any priority is returned.
   copied.push(copy as unknown as ScopedAttention);
  }
  return copied;
 }catch{return null;}
}
/** No AI model and no external actions. A saved dueAt, not a guessed SLA,
 * is the only acceptable evidence for an overdue owner priority. */
export function planOwnerAttentionSla(input:AttentionSlaSource):OwnerAttentionSlaResult{
 if(!input||!validId(input.workspaceId)||!input.actor||
    input.actor.role!=="OWNER"||input.actor.workspaceId!==input.workspaceId)
   return {ok:false,code:"ATTENTION_OWNER_REQUIRED"};
 const time=trustedQuoteInstant(input.now);
 const rows=captureAttention(input.attentionItems);
 if(time===null||!rows)
   return {ok:false,code:"ATTENTION_SOURCE_UNVERIFIED"};
 const seen=new Set<string>(),alerts:Alert[]=[];
 let unscheduled=0;
 for(const a of rows){
   if(!validId(a.id)||seen.has(a.id)||
      (a.workspaceId!==undefined&&a.workspaceId!==input.workspaceId)||
      !validId(a.resourceId)||!["OPEN","ACKNOWLEDGED","RESOLVED"].includes(a.status)||
      !["INFO","WARNING","CRITICAL"].includes(a.severity)||
      typeof a.type!=="string"||a.type.length<1||a.type.length>128||
      typeof a.resourceType!=="string"||a.resourceType.length<1||a.resourceType.length>128||
      typeof a.summary!=="string"||a.summary.length>2000||
      (a.dueAt!==undefined&&trustedQuoteInstant(a.dueAt)===null))
      return {ok:false,code:"ATTENTION_SOURCE_UNVERIFIED"};
   seen.add(a.id);
   if(a.status==="RESOLVED")continue;
   if(a.dueAt===undefined){unscheduled++;continue;}
   const due=trustedQuoteInstant(a.dueAt)!;
   if(due>=time)continue;
   const overdueMinutes=Math.floor((time-due)/60_000);
   if(!Number.isSafeInteger(overdueMinutes)||overdueMinutes<0)
     return {ok:false,code:"ATTENTION_SOURCE_UNVERIFIED"};
   alerts.push({attentionId:a.id,severity:a.severity,dueAt:a.dueAt,status:a.status as Alert["status"],
     overdueMinutes,ownerReviewRequired:true});
 }
 const rank={CRITICAL:3,WARNING:2,INFO:1};
 alerts.sort((a,b)=>rank[b.severity]-rank[a.severity]||
   Date.parse(a.dueAt)-Date.parse(b.dueAt)||a.attentionId.localeCompare(b.attentionId));
 return {ok:true,value:{state:"SAVED_ATTENTION_SLA_OWNER_REVIEW",
   source:"DOUBLE_CHECKED_SAVED_ATTENTION_ROWS",workspaceId:input.workspaceId,
   inspected:rows.length,overdueCount:alerts.length,
   unscheduledCount:unscheduled,overdue:alerts,
   ownerReviewRequired:true,modelInvoked:false,customerMessaged:false,workflowExecuted:false}};
}
const validSlug=(s:unknown):s is string=>typeof s==="string"&&
 /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)&&s.length>=3&&s.length<=40;
/** Two fresh owner-authorized reads; a changed dueAt, resolution, membership
 * or source page blocks returning a stale escalation. */
export async function loadOwnerAttentionSla(slug:string,deps:OwnerAttentionSlaDeps={}):Promise<OwnerAttentionSlaResult>{
 if(!validSlug(slug))return {ok:false,code:"ATTENTION_OWNER_REQUIRED"};
 if(deps.signal?.aborted)return {ok:false,code:"ATTENTION_CANCELLED"};
 const loader=deps.loadSnapshot??loadOperationalStaffSnapshot,now=deps.now??Date.now;
 let first:Awaited<ReturnType<Loader>>,second:Awaited<ReturnType<Loader>>;
 try{first=await loader(slug);}catch{return {ok:false,code:"ATTENTION_SOURCE_UNVERIFIED"};}
 if(!first.ok||first.value.workspace.slug!==slug||first.value.actor.role!=="OWNER"||
    !first.value.actor.userId||first.value.actor.workspaceId!==first.value.workspace.id||
    !isFreshOwnerOperationsSnapshotAt(first.value.loadedAt,now()))
   return {ok:false,code:"ATTENTION_OWNER_REQUIRED"};
 const workspaceId=first.value.workspace.id,userId=first.value.actor.userId;
 const a=planOwnerAttentionSla({workspaceId,actor:first.value.actor,now:first.value.loadedAt,
   attentionItems:first.value.attentionItems});
 if(!a.ok)return a;
 if(deps.signal?.aborted)return {ok:false,code:"ATTENTION_CANCELLED"};
 try{second=await loader(slug);}catch{return {ok:false,code:"ATTENTION_SOURCE_CHANGED"};}
 if(!second.ok||second.value.workspace.id!==workspaceId||
    second.value.workspace.slug!==slug||second.value.actor.role!=="OWNER"||
    second.value.actor.workspaceId!==workspaceId||second.value.actor.userId!==userId||
    !isFreshOwnerOperationsSnapshotAt(second.value.loadedAt,now()))
   return {ok:false,code:"ATTENTION_SOURCE_CHANGED"};
 const b=planOwnerAttentionSla({workspaceId,actor:second.value.actor,now:second.value.loadedAt,
   attentionItems:second.value.attentionItems});
 if(!b.ok||JSON.stringify(a.value)!==JSON.stringify(b.value))
   return {ok:false,code:"ATTENTION_SOURCE_CHANGED"};
 if(deps.signal?.aborted)return {ok:false,code:"ATTENTION_CANCELLED"};
 return b;
}
