import type {ConversationDTO, MessageDTO} from "../../contracts";
import {loadOperationalStaffSnapshot} from "@/features/operations/operational-product-runtime";
import {isFreshOwnerOperationsSnapshotAt} from "./owner-operations-brief";

type Loader=typeof loadOperationalStaffSnapshot;
export interface OwnerInboxReviewInput {
 workspaceId:string;actor:{workspaceId:string;role:string};
 now:string;conversations:readonly ConversationDTO[];messages:readonly MessageDTO[];
}
export type OwnerInboxReason="HUMAN_HANDOVER"|"DELIVERY_UNVERIFIED"|"CUSTOMER_AWAITING_REVIEW";
export interface InboxReviewCandidate {
 conversationId:string;version:number;channel:ConversationDTO["channel"];
 reason:OwnerInboxReason;customerLastMessageAt:string;reviewPriority:"HIGH"|"NORMAL";
 humanReviewRequired:true;customerMessageSent:false;providerDeliveryConfirmed:false;
}
export type InboxReviewPlan =
 | {ok:false;code:"INBOX_OWNER_REQUIRED"|"INBOX_SOURCE_INCOMPLETE"|"INBOX_SOURCE_INVALID"}
 | {ok:true;value:{state:"OWNER_SAVED_INBOX_REVIEW";source:"COMPLETE_SAVED_WORKSPACE_MESSAGE_HISTORY";
     candidates:InboxReviewCandidate[];inspectedConversations:number;inspectedMessages:number;
     humanReviewRequired:true;outboundMessageQueued:false;aiModelInvoked:false;}};

const id=(v:unknown):v is string=>typeof v==="string"&&/^[A-Za-z0-9:_-]{3,128}$/.test(v);
function dense(value:unknown,maximum:number):boolean{
 if(!Array.isArray(value)||value.length>=maximum||
    Reflect.ownKeys(value).length!==value.length+1)return false;
 for(let i=0;i<value.length;i++){
   const d=Object.getOwnPropertyDescriptor(value,String(i));
   if(!d||!Object.hasOwn(d,"value"))return false;
 }
 return true;
}
function timestamp(v:unknown):v is string{
 if(typeof v!=="string")return false;
 const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|([+-])(\d{2}):(\d{2}))$/.exec(v);
 if(!m)return false;
 const year=Number(m[1]),month=Number(m[2]),day=Number(m[3]);
 const hour=Number(m[4]),minute=Number(m[5]),second=Number(m[6]);
 if(year<1000||month<1||month>12||day<1||day>31||
    hour>23||minute>59||second>59)return false;
 const civil=new Date(Date.UTC(year,month-1,day));
 if(civil.getUTCFullYear()!==year||civil.getUTCMonth()+1!==month||
    civil.getUTCDate()!==day)return false;
 if(m[8]!=="Z"){
   const offsetH=Number(m[10]),offsetM=Number(m[11]);
   if(offsetH>14||offsetM>59||(offsetH===14&&offsetM!==0))return false;
 }
 return Number.isFinite(Date.parse(v));
}
function exactSavedSnapshot(value:unknown):boolean{
 return !!value&&typeof value==="object"&&!Array.isArray(value)&&
  Object.getPrototypeOf(value)===Object.prototype &&
  Object.getOwnPropertyNames(value).length===Object.keys(value).length &&
  Object.getOwnPropertySymbols(value).length===0 &&
  Object.values(Object.getOwnPropertyDescriptors(value)).every(d=>Object.hasOwn(d,"value"));
}

/** No message text or customer identities leave this planner. The input must
 * represent a COMPLETE tenant-authorized history; otherwise a recent outbound
 * could be missing from a capped row sample, producing false outreach alerts.
 * Failed/queued provider attempts NEVER count as successfully answered. */
export function planOwnerInboxReview(input:OwnerInboxReviewInput):InboxReviewPlan {
 if(!input||!id(input.workspaceId)||!input.actor||input.actor.workspaceId!==input.workspaceId||
    input.actor.role!=="OWNER")return {ok:false,code:"INBOX_OWNER_REQUIRED"};
 const conversations=input.conversations,messages=input.messages;
 if(!Array.isArray(conversations)||!Array.isArray(messages)||
    conversations.length>=200||messages.length>=1000)
   return {ok:false,code:"INBOX_SOURCE_INCOMPLETE"};
 if(!dense(conversations,200)||!dense(messages,1000)||
    !timestamp(input.now)||conversations.some(x=>!exactSavedSnapshot(x))||
    messages.some(x=>!exactSavedSnapshot(x)))
   return {ok:false,code:"INBOX_SOURCE_INVALID"};
 const cMap=new Map<string,ConversationDTO>(),mIds=new Set<string>();
 for(const c of conversations){
   if(!id(c.id)||c.workspaceId!==input.workspaceId||cMap.has(c.id)||
      !["WEB","EMAIL","WHATSAPP"].includes(c.channel) ||
      typeof c.handoverActive!=="boolean"||
      !Number.isSafeInteger(c.version)||c.version<1||
      (c.lastMessageAt!==undefined&&!timestamp(c.lastMessageAt)))
      return {ok:false,code:"INBOX_SOURCE_INVALID"};
   cMap.set(c.id,c);
 }
 const grouped=new Map<string,MessageDTO[]>();
 for(const m of messages){
   if(!id(m.id)||mIds.has(m.id)||m.workspaceId!==input.workspaceId||
      !id(m.conversationId)||!cMap.has(m.conversationId)||
      !timestamp(m.createdAt)||Date.parse(m.createdAt)>Date.parse(input.now)||
      !["INBOUND","OUTBOUND","INTERNAL"].includes(m.direction)||
      !["CUSTOMER","STAFF","AI","SYSTEM"].includes(m.senderKind)||
      (m.deliveryState!==undefined&&!["QUEUED","RUNNING","PROVIDER_ACCEPTED","DELIVERED","READ","FAILED","SUPPRESSED"].includes(m.deliveryState)))
       return {ok:false,code:"INBOX_SOURCE_INVALID"};
   mIds.add(m.id);
   const group=grouped.get(m.conversationId)??[];
   group.push(m);grouped.set(m.conversationId,group);
 }
 const candidates:InboxReviewCandidate[]=[];
 for(const c of conversations){
   const rows=(grouped.get(c.id)??[]).sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt)||a.id.localeCompare(b.id));
   const lastCustomer=rows.filter(m=>m.direction==="INBOUND"&&m.senderKind==="CUSTOMER").at(-1);
   if(!lastCustomer)continue;
   // Delivery state is only authoritative when it is an explicit successful
   // customer-facing receipt; a queued/sent provider attempt is not a reply.
   const after=rows.filter(m=>m.direction==="OUTBOUND"&&Date.parse(m.createdAt)>=Date.parse(lastCustomer.createdAt));
   const acknowledged=after.some(m=>
     Date.parse(m.createdAt)>Date.parse(lastCustomer.createdAt) &&
     (m.deliveryState==="DELIVERED"||m.deliveryState==="READ"));
   if(acknowledged&&!c.handoverActive)continue;
   const reason:OwnerInboxReason=c.handoverActive?"HUMAN_HANDOVER":
     after.length>0?"DELIVERY_UNVERIFIED":"CUSTOMER_AWAITING_REVIEW";
   candidates.push({
     conversationId:c.id,version:c.version,channel:c.channel,reason,
     customerLastMessageAt:lastCustomer.createdAt,
     reviewPriority:c.handoverActive?"HIGH":"NORMAL",
     humanReviewRequired:true,customerMessageSent:false,providerDeliveryConfirmed:false,
   });
 }
 candidates.sort((a,b)=>Number(b.reviewPriority==="HIGH")-Number(a.reviewPriority==="HIGH")||
   Date.parse(a.customerLastMessageAt)-Date.parse(b.customerLastMessageAt)||
   a.conversationId.localeCompare(b.conversationId));
 return {ok:true,value:{state:"OWNER_SAVED_INBOX_REVIEW",source:"COMPLETE_SAVED_WORKSPACE_MESSAGE_HISTORY",
   candidates,inspectedConversations:conversations.length,inspectedMessages:messages.length,
   humanReviewRequired:true,outboundMessageQueued:false,aiModelInvoked:false}};
}
export interface AuthorizedOwnerInboxDependencies {
 loadSnapshot?:Loader;now?:()=>number;signal?:AbortSignal;
}
export type AuthorizedOwnerInboxReviewResult =
 | {ok:false;code:"INBOX_INPUT_INVALID"|"INBOX_OWNER_REQUIRED"|"INBOX_SNAPSHOT_UNAVAILABLE"|
   "INBOX_SOURCE_CHANGED"|"INBOX_CANCELLED"}
 | {ok:true;value:Extract<InboxReviewPlan,{ok:true}>["value"] & {
   workspaceId:string;authorizedOwner:true;doubleChecked:true;
 }};
/** This is an actual signed-in saved-workspace read, not a model call or a
 * synthetic 'unanswered' claim. Both reads must be complete and consistent. */
export async function loadAuthorizedOwnerInboxReview(
 slug:string,deps:AuthorizedOwnerInboxDependencies={},
):Promise<AuthorizedOwnerInboxReviewResult>{
 if(typeof slug!=="string"||slug.length<3||slug.length>40||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))return {ok:false,code:"INBOX_INPUT_INVALID"};
 if(deps.signal?.aborted)return {ok:false,code:"INBOX_CANCELLED"};
 const load=deps.loadSnapshot??loadOperationalStaffSnapshot, now=deps.now??Date.now;
 let a:Awaited<ReturnType<Loader>>,b:Awaited<ReturnType<Loader>>;
 try{a=await load(slug);}catch{return {ok:false,code:"INBOX_SNAPSHOT_UNAVAILABLE"};}
 if(!a.ok||a.value.workspace.slug!==slug||a.value.actor.role!=="OWNER"||
    a.value.actor.workspaceId!==a.value.workspace.id||!a.value.actor.userId||
    !isFreshOwnerOperationsSnapshotAt(a.value.loadedAt,now()))
     return {ok:false,code:"INBOX_OWNER_REQUIRED"};
 const workspaceId=a.value.workspace.id,userId=a.value.actor.userId;
 const first=planOwnerInboxReview({
   workspaceId,actor:a.value.actor,now:a.value.loadedAt,
   conversations:a.value.conversations,messages:a.value.messages,
 });
 if(!first.ok)return {ok:false,code:"INBOX_SNAPSHOT_UNAVAILABLE"};
 if(deps.signal?.aborted)return {ok:false,code:"INBOX_CANCELLED"};
 try{b=await load(slug);}catch{return {ok:false,code:"INBOX_SOURCE_CHANGED"};}
 if(!b.ok||b.value.workspace.id!==workspaceId||b.value.workspace.slug!==slug||
    b.value.actor.role!=="OWNER"||b.value.actor.workspaceId!==workspaceId||
    b.value.actor.userId!==userId||
    !isFreshOwnerOperationsSnapshotAt(b.value.loadedAt,now()))
     return {ok:false,code:"INBOX_SOURCE_CHANGED"};
 const second=planOwnerInboxReview({
   workspaceId,actor:b.value.actor,now:b.value.loadedAt,
   conversations:b.value.conversations,messages:b.value.messages,
 });
 if(!second.ok||JSON.stringify(first.value.candidates)!==JSON.stringify(second.value.candidates)||
    first.value.inspectedMessages!==second.value.inspectedMessages||
    first.value.inspectedConversations!==second.value.inspectedConversations)
     return {ok:false,code:"INBOX_SOURCE_CHANGED"};
 if(deps.signal?.aborted)return {ok:false,code:"INBOX_CANCELLED"};
 return {ok:true,value:{...second.value,workspaceId,authorizedOwner:true,doubleChecked:true}};
}
