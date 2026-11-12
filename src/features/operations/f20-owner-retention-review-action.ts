"use server";
import {proposeF04SavedRetentionReview} from "@/server/ai/f04-saved-retention-review";
import {trustedQuoteInstant} from "./quote-validity-clock";
type Kind="REPEAT_CLEANING_REVIEW"|"SERVICE_GAP_REVIEW_NOT_CHURN_PROOF";
export type F20RetentionReply=
 | {ok:false;state:"SAVED_RETENTION_UNAVAILABLE"}
 | {ok:true;state:"OWNER_CONSENTED_RETENTION_REVIEW";candidateCount:number;
   candidates:Array<{customerId:string;channel:"EMAIL"|"WHATSAPP";kind:Kind;
    lastCompletedVisitId:string;savedCompletedVisitCount:number;
    consentRecordedAt:string;controlVersion:number}>;
   historicalCompletenessVerified:false;churnProven:false;sendConsentMustBeRechecked:true;
   staffApprovalRequired:true;messagesSent:false;outreachScheduled:false;
   modelInvoked:false;paymentChanged:false};
const denied=():F20RetentionReply=>({ok:false,state:"SAVED_RETENTION_UNAVAILABLE"});
const id=(x:unknown):x is string=>typeof x==="string"&&/^[A-Za-z0-9:_-]{3,128}$/.test(x);
/** Two-read owner-only F04 saved retention source; no recipient address,
 * message draft, provider action, churn certainty or outreach scheduling. */
export async function requestF20RetentionReview(slug:string):Promise<F20RetentionReply>{
 if(typeof slug!=="string"||slug.length<3||slug.length>40||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))return denied();
 try{
  const result=await proposeF04SavedRetentionReview(slug);
  if(!result.ok)return denied();
  const v=result.value;
  if(v.state!=="SAVED_HISTORY_RETENTION_REVIEW_ONLY"||
     v.source!=="DOUBLE_READ_SAVED_VISITS_REQUESTS_AND_EXPLICIT_OPT_IN"||
     v.sourceCompletenessUnverified!==true||v.churnProven!==false||
     v.staffApprovalRequired!==true||v.noAutonomousSend!==true||
     v.paymentChanged!==false||v.modelInvoked!==false||
     v.businessStateMutated!==false||trustedQuoteInstant(v.sourceClock)===null||
     !Array.isArray(v.candidates)||v.candidates.length>399)return denied();
  const seen=new Set<string>();
  const candidates:Extract<F20RetentionReply,{ok:true}>["candidates"]=[];
  for(const c of v.candidates){
   const key=c.customerId+":"+c.channel;
   if(!id(c.customerId)||!id(c.lastCompletedVisitId)||
      !["EMAIL","WHATSAPP"].includes(c.channel)||
      !["REPEAT_CLEANING_REVIEW","SERVICE_GAP_REVIEW_NOT_CHURN_PROOF"].includes(c.kind)||
      seen.has(key)||trustedQuoteInstant(c.customerConsentRecordedAt)===null||
      !Number.isSafeInteger(c.retentionControlVersion)||c.retentionControlVersion<1||
      !Number.isSafeInteger(c.savedCompletedVisitCount)||c.savedCompletedVisitCount<1||
      c.manualContactAndPurposeRevalidationRequired!==true||
      c.customerContactSent!==false||c.outreachScheduled!==false)return denied();
   seen.add(key);
   candidates.push({customerId:c.customerId,channel:c.channel,kind:c.kind,
    lastCompletedVisitId:c.lastCompletedVisitId,
    savedCompletedVisitCount:c.savedCompletedVisitCount,
    consentRecordedAt:c.customerConsentRecordedAt,
    controlVersion:c.retentionControlVersion});
  }
  return {ok:true,state:"OWNER_CONSENTED_RETENTION_REVIEW",
   candidateCount:candidates.length,candidates:candidates.slice(0,25),
   historicalCompletenessVerified:false,churnProven:false,
   sendConsentMustBeRechecked:true,staffApprovalRequired:true,
   messagesSent:false,outreachScheduled:false,modelInvoked:false,
   paymentChanged:false};
 }catch{return denied();}
}
