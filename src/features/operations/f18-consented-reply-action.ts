"use server";
import {proposeF04ConsentedReplyDraft} from "@/server/ai/f04-consented-reply-draft";
export type F18InboxDraft=
 | {ok:false;state:"CONSENTED_DRAFT_UNAVAILABLE"}
 | {ok:true;state:"CONSENTED_DRAFT_REVIEW_ONLY";channel:"EMAIL"|"WHATSAPP";
   conversationVersion:number;draftText:string;staffApprovalRequired:true;
   sendTimeConsentRecheckRequired:true;sourceHistoryComplete:false;
   providerInvoked:false;modelInvoked:false;messageSent:false;saved:false};
const denied=():F18InboxDraft=>({ok:false,state:"CONSENTED_DRAFT_UNAVAILABLE"});
const expected="Thanks for reaching out. Our team will review your request and respond with verified details.";
/** F04 does two authorized saved reads and checks latest verified recipient,
 * consent, retention control, and the current inbound thread before drafting.
 * No browser recipient address, customer ID, history, or provider call. */
export async function requestF18ConsentedReplyDraft(
 workspaceSlug:string,conversationId:string,
):Promise<F18InboxDraft>{
 if(typeof workspaceSlug!=="string"||workspaceSlug.length<3||
    workspaceSlug.length>40||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(workspaceSlug)||
    typeof conversationId!=="string"||conversationId.length<3||
    conversationId.length>128||!/^[A-Za-z0-9:_-]+$/.test(conversationId))return denied();
 try{
  const r=await proposeF04ConsentedReplyDraft(workspaceSlug,conversationId);
  if(!r.ok)return denied();
  const v=r.value;
  if(v.state!=="SAVED_THREAD_DRAFT_STAFF_REVIEW_REQUIRED"||
     v.source!=="DOUBLE_READ_SAVED_CONVERSATION_AND_CHANNEL_CONSENT"||
     v.conversationId!==conversationId||
     !Number.isSafeInteger(v.conversationVersion)||v.conversationVersion<1||
     !["EMAIL","WHATSAPP"].includes(v.channel)||
     v.sourceCompletenessUnverified!==true||
     v.sendingConsentMustBeRechecked!==true||
     v.staffApprovalRequired!==true||v.outboundMessageQueued!==false||
     v.customerContactSent!==false||v.providerInvoked!==false||
     v.modelInvoked!==false||v.businessStateMutated!==false||
     v.draftText!==expected)return denied();
  return {ok:true,state:"CONSENTED_DRAFT_REVIEW_ONLY",
   channel:v.channel,conversationVersion:v.conversationVersion,
   draftText:expected,staffApprovalRequired:true,
   sendTimeConsentRecheckRequired:true,sourceHistoryComplete:false,
   providerInvoked:false,modelInvoked:false,messageSent:false,saved:false};
 }catch{return denied();}
}
