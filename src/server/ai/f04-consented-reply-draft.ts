import {loadOperationalStaffSnapshot,type OperationalStaffSnapshot} from "@/features/operations/operational-product-runtime";
import {trustedQuoteInstant} from "@/features/operations/quote-validity-clock";

type Loader=typeof loadOperationalStaffSnapshot;
export interface F04DraftDependencies {loadSnapshot?:Loader;now?:()=>number;signal?:AbortSignal}
export type F04DraftResult=
 | {ok:false;code:"F04_DRAFT_INVALID"|"F04_DRAFT_OWNER_REQUIRED"|"F04_DRAFT_SOURCE_UNAVAILABLE"|
   "F04_DRAFT_SOURCE_INCOMPLETE"|"F04_DRAFT_RECIPIENT_UNVERIFIED"|
   "F04_DRAFT_CONSENT_DENIED"|"F04_DRAFT_THREAD_NOT_REVIEWABLE"|
   "F04_DRAFT_SOURCE_CHANGED"|"F04_DRAFT_CANCELLED"}
 | {ok:true;value:{
   state:"SAVED_THREAD_DRAFT_STAFF_REVIEW_REQUIRED";
   source:"DOUBLE_READ_SAVED_CONVERSATION_AND_CHANNEL_CONSENT";
   workspaceId:string;conversationId:string;conversationVersion:number;
   latestInboundMessageId:string;channel:"EMAIL"|"WHATSAPP";
   customerId:string;recipientContactId:string;
   consentRecordedAt:string;
   draftText:string;
   sourceCompletenessUnverified:true;
   sendingConsentMustBeRechecked:true;
   staffApprovalRequired:true;outboundMessageQueued:false;customerContactSent:false;
   providerInvoked:false;modelInvoked:false;businessStateMutated:false;
 }};
const deny=(code:Extract<F04DraftResult,{ok:false}>["code"]):F04DraftResult=>({ok:false,code});
const id=(v:unknown):v is string=>typeof v==="string"&&/^[A-Za-z0-9:_-]{3,128}$/.test(v);
const time=(v:unknown)=>trustedQuoteInstant(v);
const dense=(v:unknown,cap:number):v is Record<string,unknown>[]=>{
 if(!Array.isArray(v)||Object.getPrototypeOf(v)!==Array.prototype||v.length>=cap||
   Reflect.ownKeys(v).length!==v.length+1)return false;
 return v.every(x=>{if(!x||typeof x!=="object"||Array.isArray(x)||
   Object.getPrototypeOf(x)!==Object.prototype)return false;
   const d=Object.getOwnPropertyDescriptors(x);
   return Reflect.ownKeys(x).length===Object.keys(x).length&&
     Object.values(d).every(o=>Object.hasOwn(o,"value"));
 });
};
function authorized(s:OperationalStaffSnapshot,slug:string,now:number):boolean{
 const at=time(s.loadedAt);
 return s.workspace?.slug===slug&&id(s.workspace.id)&&
   s.actor?.workspaceId===s.workspace.id&&id(s.actor.userId)&&s.actor.role==="OWNER"&&
   s.branchScope?.mode==="ALL"&&at!==null&&Number.isFinite(now)&&
   at>=now-300_000&&at<=now+60_000;
}
type Projection={fingerprint:string;decision:"READY"|"CONSENT"|"RECIPIENT"|"THREAD";
 conversationVersion:number;messageId?:string;customerId?:string;contactId?:string;
 channel?:"EMAIL"|"WHATSAPP";recordedAt?:string};
function project(s:OperationalStaffSnapshot,conversationId:string):Projection|null{
 if(s.retentionAvailable!==true||!dense(s.conversations,200)||
    !dense(s.messages,1000)||!dense(s.customerContacts,500)||
    !dense(s.communicationConsents,2000)||!dense(s.retentionControls,1000)||
    !dense(s.customers,200))return null;
 const conversations=s.conversations, messages=s.messages;
 const ids=new Set<string>(),msgIds=new Set<string>();
 for(const c of conversations){
  if(!id(c.id)||ids.has(c.id)||c.workspaceId!==s.workspace.id||
     !["EMAIL","WHATSAPP","WEB"].includes(c.channel)||
     !Number.isSafeInteger(c.version)||c.version<1||typeof c.handoverActive!=="boolean"||
     (c.customerId!==undefined&&!id(c.customerId)))return null;
  ids.add(c.id);
 }
 for(const m of messages){
  if(!id(m.id)||msgIds.has(m.id)||m.workspaceId!==s.workspace.id||
     !ids.has(m.conversationId)||time(m.createdAt)===null||
     !["INBOUND","OUTBOUND","INTERNAL"].includes(m.direction)|| 
     !["CUSTOMER","STAFF","AI","SYSTEM"].includes(m.senderKind))return null;
  msgIds.add(m.id);
 }
 const c=conversations.find(x=>x.id===conversationId);
 if(!c)return null;
 const relevant=messages.filter(x=>x.conversationId===conversationId)
  .sort((a,b)=>time(a.createdAt)!-time(b.createdAt)!||a.id.localeCompare(b.id));
 const lastInbound=[...relevant].reverse().find(x=>x.direction==="INBOUND"&&x.senderKind==="CUSTOMER");
 const status:Projection["decision"]= !c.customerId||c.channel==="WEB"||!lastInbound||
   (lastInbound&&relevant.some(m=>m.direction==="OUTBOUND"&&
     time(m.createdAt)!>time(lastInbound.createdAt)!&&
     (m.deliveryState==="DELIVERED"||m.deliveryState==="READ")))
   ?"THREAD":"READY";
 const channel=c.channel==="EMAIL"||c.channel==="WHATSAPP"?c.channel:undefined;
 const consent=channel?s.communicationConsents.filter(x=>x.customerId===c.customerId&&x.channel===channel):[];
 const controls=channel?s.retentionControls.filter(x=>x.customerId===c.customerId&&x.channel===channel):[];
 const requiredKind=channel==="EMAIL"?"EMAIL":"PHONE";
 const contacts=s.customerContacts.filter(x=>x.customerId===c.customerId&&x.kind===requiredKind&&
   x.isPrimary&&id(x.id)&&typeof x.value==="string"&&x.value.trim()&&
   time(x.verifiedAt)!==null&&x.identityConflictCount===1);
 const customer=s.customers.some(x=>x.id===c.customerId);
 if(!customer)return null;
 if(consent.some(x=>time(x.recordedAt)===null)||controls.some(x=>
   !Number.isSafeInteger(x.version)||x.version<1))return null;
 const consentOk=consent.length===1&&consent[0].status==="GRANTED"&&
   ["GENERAL","SERVICE","CUSTOMER_SERVICE","SUPPORT"].includes(consent[0].purpose)&&
   time(consent[0].recordedAt)!<=time(s.loadedAt)!&&
   controls.length<=1&&controls.every(x=>x.status==="ACTIVE");
 const decision=status!=="READY"?"THREAD":!consentOk?"CONSENT":contacts.length!==1?"RECIPIENT":"READY";
 const fingerprint=JSON.stringify({
  conversation:[c.id,c.workspaceId,c.version,c.channel,c.customerId,c.handoverActive,c.lastMessageAt],
  messages:relevant.map(m=>[m.id,m.conversationId,m.direction,m.senderKind,m.createdAt,m.deliveryState??null,m.body??null]),
  consent:consent.map(x=>[x.customerId,x.channel,x.status,x.purpose,x.recordedAt]),
  controls:controls.map(x=>[x.customerId,x.channel,x.status,x.version,x.untilAt??null]),
  contacts:s.customerContacts.filter(x=>x.customerId===c.customerId).map(x=>
   [x.id,x.customerId,x.kind,x.value,x.verifiedAt,x.identityConflictCount,x.isPrimary]),
 });
 return {fingerprint,decision,conversationVersion:c.version,
  messageId:lastInbound?.id,customerId:c.customerId,contactId:contacts[0]?.id,
  channel,recordedAt:consent[0]?.recordedAt};
}
/** A deterministic draft, never model-generated and never sent. Saved
 * consent/customer contact is a review-time check, not delivery authorization.
 * The downstream send command MUST re-read consent, opt-out and recipient.
 */
export async function proposeF04ConsentedReplyDraft(
 workspaceSlug:string,conversationId:string,deps:F04DraftDependencies={},
):Promise<F04DraftResult>{
 if(typeof workspaceSlug!=="string"||workspaceSlug.length<3||workspaceSlug.length>40||
   !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(workspaceSlug)||!id(conversationId))
   return deny("F04_DRAFT_INVALID");
 if(deps.signal?.aborted)return deny("F04_DRAFT_CANCELLED");
 const load=deps.loadSnapshot??loadOperationalStaffSnapshot,now=deps.now??Date.now;
 let a:Awaited<ReturnType<Loader>>;
 try{a=await load(workspaceSlug);}catch{return deny("F04_DRAFT_SOURCE_UNAVAILABLE");}
 if(!a.ok||!authorized(a.value,workspaceSlug,now()))return deny("F04_DRAFT_OWNER_REQUIRED");
 const first=project(a.value,conversationId);
 if(!first)return deny("F04_DRAFT_SOURCE_INCOMPLETE");
 if(first.decision!=="READY")return deny(first.decision==="CONSENT"
   ?"F04_DRAFT_CONSENT_DENIED":first.decision==="RECIPIENT"?
   "F04_DRAFT_RECIPIENT_UNVERIFIED":"F04_DRAFT_THREAD_NOT_REVIEWABLE");
 if(deps.signal?.aborted)return deny("F04_DRAFT_CANCELLED");
 let b:Awaited<ReturnType<Loader>>;
 try{b=await load(workspaceSlug);}catch{return deny("F04_DRAFT_SOURCE_UNAVAILABLE");}
 if(!b.ok||!authorized(b.value,workspaceSlug,now())||
    b.value.workspace.id!==a.value.workspace.id||
    b.value.actor.userId!==a.value.actor.userId)return deny("F04_DRAFT_SOURCE_CHANGED");
 const second=project(b.value,conversationId);
 if(!second||second.fingerprint!==first.fingerprint||second.decision!=="READY")
    return deny("F04_DRAFT_SOURCE_CHANGED");
 if(deps.signal?.aborted)return deny("F04_DRAFT_CANCELLED");
 if(!second.messageId||!second.customerId||!second.contactId||!second.channel||!second.recordedAt)
   return deny("F04_DRAFT_SOURCE_INCOMPLETE");
 return {ok:true,value:{
  state:"SAVED_THREAD_DRAFT_STAFF_REVIEW_REQUIRED",
  source:"DOUBLE_READ_SAVED_CONVERSATION_AND_CHANNEL_CONSENT",
  workspaceId:b.value.workspace.id,conversationId,conversationVersion:second.conversationVersion,
  latestInboundMessageId:second.messageId,channel:second.channel,
  customerId:second.customerId,recipientContactId:second.contactId,
  consentRecordedAt:second.recordedAt,
  draftText:"Thanks for reaching out. Our team will review your request and respond with verified details.",
  sourceCompletenessUnverified:true,sendingConsentMustBeRechecked:true,
  staffApprovalRequired:true,outboundMessageQueued:false,customerContactSent:false,
  providerInvoked:false,modelInvoked:false,businessStateMutated:false,
 }};
}
