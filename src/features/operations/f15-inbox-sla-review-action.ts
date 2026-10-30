"use server";
import {loadAuthorizedF15InboxSlaReview} from "@/server/ai/owner-inbox-f15-sla-review";
export type F15InboxSlaUIResult=
 | {ok:false;state:"SAVED_SLA_REVIEW_UNAVAILABLE"}
 | {ok:true;state:"SAVED_SLA_OVERDUE"|"SAVED_SLA_NOT_DUE";
    dueAt:string;thresholdMinutes:number;channel:"WEB"|"EMAIL"|"WHATSAPP";
    requestVersion:number;staffReviewRequired:true;eventRecorded:false;
    messageSent:false;providerInvoked:false;modelInvoked:false;moneyChanged:false};
const denied=():F15InboxSlaUIResult=>({ok:false,state:"SAVED_SLA_REVIEW_UNAVAILABLE"});
/** Explicit owner action only. No provider, no event-claim RPC. */
export async function requestF15InboxSlaReview(
 workspaceSlug:string,conversationId:string,thresholdMinutes:number,
):Promise<F15InboxSlaUIResult>{
 if(typeof workspaceSlug!=="string"||workspaceSlug.length<3||workspaceSlug.length>40||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(workspaceSlug)||
    typeof conversationId!=="string"||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(conversationId)||
    ![30,60,120].includes(thresholdMinutes))return denied();
 try{
  const result=await loadAuthorizedF15InboxSlaReview(workspaceSlug,conversationId,thresholdMinutes);
  if(!result.ok)return denied();
  const v=result.value;
  if(!["SAVED_INBOX_LEAD_OVERDUE_REVIEW","SAVED_INBOX_LEAD_NO_ESCALATION_DUE"].includes(v.state)||
     v.source!=="TWO_OWNER_AUTHORIZED_REQUEST_AND_MESSAGE_READS"||
     v.staffReviewRequired!==true||v.eventRecorded!==false||
     v.externalMessageQueued!==false||v.customerMessageSent!==false||
     v.providerInvoked!==false||v.modelInvoked!==false||v.moneyChanged!==false||
     !["WEB","EMAIL","WHATSAPP"].includes(v.channel)||
     typeof v.dueAt!=="string"||!Number.isSafeInteger(v.sourceVersion))
    return denied();
  return {ok:true,
   state:v.state==="SAVED_INBOX_LEAD_OVERDUE_REVIEW"?"SAVED_SLA_OVERDUE":"SAVED_SLA_NOT_DUE",
   dueAt:v.dueAt,thresholdMinutes:v.thresholdMinutes,
   channel:v.channel,requestVersion:v.sourceVersion,
   staffReviewRequired:true,eventRecorded:false,messageSent:false,
   providerInvoked:false,modelInvoked:false,moneyChanged:false,
  };
 }catch{return denied();}
}
