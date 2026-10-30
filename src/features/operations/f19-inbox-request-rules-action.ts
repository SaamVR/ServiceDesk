"use server";
import {processOwnerInboxRequestRules} from "@/server/ai/owner-inbox-request-rules";
export type InboxRulesActionResult=
 | {ok:false;state:"INTERNAL_REQUEST_RULES_UNAVAILABLE"}
 | {ok:true;state:"INTERNAL_ATTENTION_VERIFIED"|"NO_INTERNAL_ATTENTION_CREATED";
    matchedRules:number;completedAttentionActions:number;
    newlyRecordedExecutions:number;reusedExecutions:number;
    externalApprovalRequired:number;sourceEventReplayed:boolean;
    persistedInternalAttentionVerified:boolean;
    ownerTriggered:true;externalMessagesSent:0;
    customerMessageSent:false;moneyChanged:false;automaticSlaEventCreated:false};
const denied=():InboxRulesActionResult=>({ok:false,state:"INTERNAL_REQUEST_RULES_UNAVAILABLE"});
/** The selected Inbox conversation ID is NOT a trusted request ID. */
export async function runInboxPublishedRequestRules(
 workspaceSlug:string,conversationId:string,
):Promise<InboxRulesActionResult>{
 if(typeof workspaceSlug!=="string"||workspaceSlug.length<3||workspaceSlug.length>40||
  !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(workspaceSlug)||
  typeof conversationId!=="string"||
  !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(conversationId))
   return denied();
 try{
  const res=await processOwnerInboxRequestRules(workspaceSlug,conversationId);
  if(!res.ok)return denied();
  const v=res.value;
  if(!["PERSISTED_INTERNAL_REQUEST_RULES","NO_INTERNAL_ATTENTION_CREATED"].includes(v.state)||
     v.ownerTriggered!==true||v.externalMessagesSent!==0||
     v.customerMessageSent!==false||v.moneyChanged!==false||
     v.automaticSlaEventCreated!==false||
     v.persistedInternalAttentionVerified!==(v.completedAttentionActions>0))
    return denied();
  return {ok:true,
   state:v.state==="PERSISTED_INTERNAL_REQUEST_RULES"?
    "INTERNAL_ATTENTION_VERIFIED":"NO_INTERNAL_ATTENTION_CREATED",
   matchedRules:v.matchedRules,completedAttentionActions:v.completedAttentionActions,
   newlyRecordedExecutions:v.newlyRecordedExecutions,reusedExecutions:v.reusedExecutions,
   externalApprovalRequired:v.externalApprovalRequired,
   sourceEventReplayed:v.sourceEventReplayed,
   persistedInternalAttentionVerified:v.persistedInternalAttentionVerified,
   ownerTriggered:true,externalMessagesSent:0,customerMessageSent:false,
   moneyChanged:false,automaticSlaEventCreated:false,
  };
 }catch{return denied();}
}
