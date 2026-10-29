import {buildStaffQuoteChecklist} from "./staff-quote-checklist";
import {trustedQuoteInstant} from "./quote-validity-clock";
import type {OperationalQuote} from "./operational-product-runtime";
export type QuoteRecoveryReason="SOURCE_UNVERIFIED"|"AMBIGUOUS_CURRENT_VERSION"|
 "HISTORICAL_VERSION"|"SAVED_CHARGES_UNVERIFIED"|"EXPIRED_OR_UNKNOWN_VALIDITY"|
 "STAFF_APPROVAL_REQUIRED"|"READY_FOR_MANUAL_SEND_REVIEW"|"SENT_DELIVERY_UNVERIFIED"|
 "STATUS_REVIEW_REQUIRED";
export type QuoteRecoveryGuidance={
 state:"HUMAN_REVIEW_ONLY";reason:QuoteRecoveryReason;action:
 "REFRESH_SAVED_RECORDS"|"OPEN_CURRENT_QUOTE"|"REVIEW_REQUEST_AND_PRICING"|
 "RENEW_QUOTE"|"APPROVE_FROM_SOURCE"|"VERIFY_SEND_IN_AUTHORITATIVE_QUOTE"|
 "VERIFY_CUSTOMER_DELIVERY"|"REVIEW_STATUS";
 canSendAutomatically:false;canIssueQuoteAutomatically:false;
 customerMessaged:false;paymentChanged:false;
};
const fail=(reason:QuoteRecoveryReason,action:QuoteRecoveryGuidance["action"]):QuoteRecoveryGuidance=>
 ({state:"HUMAN_REVIEW_ONLY",reason,action,canSendAutomatically:false,
   canIssueQuoteAutomatically:false,customerMessaged:false,paymentChanged:false});
/** Quote-specific persisted recovery. Never conflate arbitrary highlighted
 * quote row with the sole current version, or an APPROVED flag with verified
 * customer delivery. No external sends or source mutation occur here. */
export function guideSavedQuoteRecovery(quotes:readonly OperationalQuote[],
 selectedId:string,loadedAt:string):QuoteRecoveryGuidance{
 if(!Array.isArray(quotes)||quotes.length===0||quotes.length>=300||
    typeof selectedId!=="string"||!selectedId||
    typeof loadedAt!=="string"||trustedQuoteInstant(loadedAt)===null)
   return fail("SOURCE_UNVERIFIED","REFRESH_SAVED_RECORDS");
 const target=quotes.find(q=>q.id===selectedId);
 if(!target||!Number.isSafeInteger(target.version)||target.version<1||
    typeof target.requestId!=="string"||!target.requestId)
   return fail("SOURCE_UNVERIFIED","REFRESH_SAVED_RECORDS");
 const related=quotes.filter(q=>q.requestId===target.requestId);
 if(related.some(q=>!Number.isSafeInteger(q.version)||q.version<1||
   typeof q.id!=="string"||!q.id)||
   new Set(quotes.map(q=>q.id)).size!==quotes.length)
   return fail("SOURCE_UNVERIFIED","REFRESH_SAVED_RECORDS");
 const highest=Math.max(...related.map(q=>q.version));
 const currents=related.filter(q=>q.version===highest);
 if(currents.length!==1)return fail("AMBIGUOUS_CURRENT_VERSION","REFRESH_SAVED_RECORDS");
 if(target.id!==currents[0].id)return fail("HISTORICAL_VERSION","OPEN_CURRENT_QUOTE");
 const checklist=buildStaffQuoteChecklist(target,loadedAt);
 const charges=checklist.items.find(x=>x.key==="charges");
 const validity=checklist.items.find(x=>x.key==="validity");
 if(charges?.state!=="PASS")return fail("SAVED_CHARGES_UNVERIFIED","REVIEW_REQUEST_AND_PRICING");
 if(validity?.state!=="PASS")return fail("EXPIRED_OR_UNKNOWN_VALIDITY","RENEW_QUOTE");
 if(target.status==="APPROVED"){
  if(!checklist.readyForHumanReview)return fail("SOURCE_UNVERIFIED","REFRESH_SAVED_RECORDS");
  return fail("READY_FOR_MANUAL_SEND_REVIEW","VERIFY_SEND_IN_AUTHORITATIVE_QUOTE");
 }
 if(target.status==="SENT")return fail("SENT_DELIVERY_UNVERIFIED","VERIFY_CUSTOMER_DELIVERY");
 if(target.status==="DRAFT")return fail("STAFF_APPROVAL_REQUIRED","APPROVE_FROM_SOURCE");
 return fail("STATUS_REVIEW_REQUIRED","REVIEW_STATUS");
}
