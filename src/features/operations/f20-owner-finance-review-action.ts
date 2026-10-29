"use server";
import {loadF03AuthorizedLedgerExplanation} from "@/server/ai/f03-saved-ledger-explanations";
type ReasonCode="LEDGER_TOTALS_RECONCILIATION"|"ISSUED_BALANCE_REVIEW"|
 "PARTIAL_BALANCE_REVIEW"|"PAID_STATUS_LEDGER_CONFLICT"|"VOID_REMAINDER_REVIEW";
export type F20FinanceReply =
 | {ok:false;state:"SAVED_LEDGER_REVIEW_UNAVAILABLE"}
 | {ok:true;state:"AUTHORIZED_LEDGER_EXCEPTIONS_FOR_REVIEW";
    inspectedCount:number;exceptionCount:number;
    cases:Array<{invoiceId:string;priority:"HIGH"|"NORMAL";
      reasons:Array<{code:ReasonCode;explanation:string;staffAction:string}>}>;
    humanReviewRequired:true;paymentConfirmed:false;refundAuthorized:false;
    messagesSent:false;financialWrites:false;modelInvoked:false};
const denied=():F20FinanceReply=>({ok:false,state:"SAVED_LEDGER_REVIEW_UNAVAILABLE"});
const codeSet=new Set<ReasonCode>(["LEDGER_TOTALS_RECONCILIATION",
 "ISSUED_BALANCE_REVIEW","PARTIAL_BALANCE_REVIEW","PAID_STATUS_LEDGER_CONFLICT",
 "VOID_REMAINDER_REVIEW"]);
const id=(s:unknown):s is string=>typeof s==="string"&&/^[A-Za-z0-9:_-]{3,128}$/.test(s);
/** Only the owner-authorized double-read F03 ledger explanation is exposed,
 * without balance amounts, contacts or payment-provider claims. */
export async function requestF20OwnerFinanceReview(slug:string):Promise<F20FinanceReply>{
 if(typeof slug!=="string"||slug.length<3||slug.length>40||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))return denied();
 try{
  const source=await loadF03AuthorizedLedgerExplanation(slug);
  if(!source.ok)return denied();
  const v=source.value;
  if(v.state!=="SAVED_LEDGER_EXCEPTION_EXPLANATION_FOR_OWNER_REVIEW"||
     v.source!=="DOUBLE_VERIFIED_AUTHORIZED_INVOICE_REVIEW"||
     !Number.isSafeInteger(v.inspectedInvoiceCount)||v.inspectedInvoiceCount<0||
     v.inspectedInvoiceCount>=300||
     !Number.isSafeInteger(v.exceptionCount)||v.exceptionCount<0||
     v.exceptionCount>v.inspectedInvoiceCount||
     !Array.isArray(v.explanations)||v.explanations.length!==v.exceptionCount||
     v.ledgerSourceUnavailable!==false||v.revenueAsserted!==false||
     v.paymentConfirmed!==false||v.refundAuthorized!==false||
     v.invoiceWritten!==false||v.customerMessageSent!==false||
     v.modelInvoked!==false)return denied();
  const seen=new Set<string>();
  const cases:Extract<F20FinanceReply,{ok:true}>["cases"]=[];
  for(const item of v.explanations){
   if(!id(item.invoiceId)||seen.has(item.invoiceId)||
      !["HIGH","NORMAL"].includes(item.priority)||item.humanApprovalRequired!==true||
      !Array.isArray(item.reasons)||item.reasons.length<1||item.reasons.length>5)return denied();
   seen.add(item.invoiceId);
   const codes=new Set<string>();
   for(const row of item.reasons){
    if(!codeSet.has(row.code)||codes.has(row.code)||
       typeof row.explanation!=="string"||row.explanation.length<10||
       row.explanation.length>240||typeof row.staffAction!=="string"||
       row.staffAction.length<10||row.staffAction.length>240)return denied();
    codes.add(row.code);
   }
   cases.push({invoiceId:item.invoiceId,priority:item.priority,
    reasons:item.reasons.map(x=>({code:x.code,explanation:x.explanation,
     staffAction:x.staffAction}))});
  }
  return {ok:true,state:"AUTHORIZED_LEDGER_EXCEPTIONS_FOR_REVIEW",
   inspectedCount:v.inspectedInvoiceCount,exceptionCount:v.exceptionCount,cases,
   humanReviewRequired:true,paymentConfirmed:false,refundAuthorized:false,
   messagesSent:false,financialWrites:false,modelInvoked:false};
 }catch{return denied();}
}
