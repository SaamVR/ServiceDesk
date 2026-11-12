import {
  loadAuthorizedOwnerFinanceReview,
  type AuthorizedFinanceReviewResult,
} from "./authorized-finance-review";
import type {FinanceReviewCode} from "./invoice-exception-review";

type FinanceLoader = typeof loadAuthorizedOwnerFinanceReview;
export interface F03FinanceExplanationDependencies {
  loadReview?: FinanceLoader;
  now?: () => number;
  signal?: AbortSignal;
}
export type F03FinanceExplanationResult =
  | {ok:false;code:
      "F03_FINANCE_INPUT_INVALID"|"F03_FINANCE_ACCESS_REQUIRED"|
      "F03_FINANCE_SOURCE_UNAVAILABLE"|"F03_FINANCE_REVIEW_CANCELLED"}
  | {ok:true;value:{
      state:"SAVED_LEDGER_EXCEPTION_EXPLANATION_FOR_OWNER_REVIEW";
      source:"DOUBLE_VERIFIED_AUTHORIZED_INVOICE_REVIEW";
      workspaceId:string;
      inspectedInvoiceCount:number;
      exceptionCount:number;
      explanations:Array<{
        invoiceId:string;
        priority:"HIGH"|"NORMAL";
        reasons:Array<{
          code:FinanceReviewCode;
          explanation:string;
          staffAction:string;
        }>;
        humanApprovalRequired:true;
      }>;
      ledgerSourceUnavailable:false;
      revenueAsserted:false;
      paymentConfirmed:false;
      refundAuthorized:false;
      invoiceWritten:false;
      customerMessageSent:false;
      modelInvoked:false;
    }};

const explanatoryRules:Record<FinanceReviewCode,readonly [string,string]>={
  LEDGER_TOTALS_RECONCILIATION:[
    "Saved invoice ledger totals do not reconcile under the recorded balance formula.",
    "Inspect the authoritative invoice ledger and payment allocations manually.",
  ],
  ISSUED_BALANCE_REVIEW:[
    "An issued invoice has a remaining saved balance; this is not proof of delinquency.",
    "Review the saved invoice and ledger before deciding whether any follow-up is appropriate.",
  ],
  PARTIAL_BALANCE_REVIEW:[
    "A partially paid invoice has a saved remaining balance; provider settlement is not independently verified.",
    "Review recorded allocations, reconciled receipts and outstanding balance manually.",
  ],
  PAID_STATUS_LEDGER_CONFLICT:[
    "The saved PAID status conflicts with its remaining ledger balance; payment is not confirmed by this report.",
    "Investigate the stored invoice status and authoritative transaction ledger.",
  ],
  VOID_REMAINDER_REVIEW:[
    "The saved VOID status retains a balance requiring manual reconciliation.",
    "Review void history and remaining invoice allocations before taking action.",
  ],
};
const codeSet=new Set<FinanceReviewCode>(Object.keys(explanatoryRules) as FinanceReviewCode[]);
const id=(v:unknown):v is string=>
  typeof v==="string" && /^[A-Za-z0-9:_-]{3,128}$/.test(v);
const bad=(code:Extract<F03FinanceExplanationResult,{ok:false}>["code"]):F03FinanceExplanationResult=>
  ({ok:false,code});

/** Read-only human explanation of the existing STRICT ledger exception planner.
 * Reuses the owner authenticated double-read projection which already fixes
 * #765; does not duplicate invoice arithmetic, call AI or infer revenue.
 */
export async function loadF03AuthorizedLedgerExplanation(
  workspaceSlug:string,
  deps:F03FinanceExplanationDependencies={},
):Promise<F03FinanceExplanationResult> {
  if(typeof workspaceSlug!=="string" || workspaceSlug.length<3 ||
     workspaceSlug.length>40 ||
     !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(workspaceSlug))
    return bad("F03_FINANCE_INPUT_INVALID");
  if(deps.signal?.aborted)return bad("F03_FINANCE_REVIEW_CANCELLED");
  let review:AuthorizedFinanceReviewResult;
  try{
    review=await (deps.loadReview??loadAuthorizedOwnerFinanceReview)(
      workspaceSlug,{now:deps.now});
  }catch{return bad("F03_FINANCE_SOURCE_UNAVAILABLE");}
  if(!review.ok)
    return bad(review.code==="FINANCE_OWNER_REQUIRED"
      ?"F03_FINANCE_ACCESS_REQUIRED":"F03_FINANCE_SOURCE_UNAVAILABLE");
  if(deps.signal?.aborted)return bad("F03_FINANCE_REVIEW_CANCELLED");
  const source=review.value;
  if(source.state!=="FINANCE_OWNER_MANUAL_REVIEW" ||
     source.source!=="AUTHORIZED_SAVED_INVOICE_SNAPSHOT" ||
     !id(source.workspaceId) || !Number.isSafeInteger(source.inspectedCount) ||
     source.inspectedCount<0 || source.inspectedCount>=300 ||
     !Number.isSafeInteger(source.exceptionCount) ||
     source.exceptionCount<0 ||
     !Array.isArray(source.exceptions) ||
     source.exceptions.length!==source.exceptionCount ||
     source.exceptionCount>source.inspectedCount ||
     source.paymentConfirmed!==false || source.refundAuthorized!==false ||
     source.providerMessageQueued!==false)
    return bad("F03_FINANCE_SOURCE_UNAVAILABLE");
  const seen=new Set<string>();
  const explanations:Extract<F03FinanceExplanationResult,{ok:true}>["value"]["explanations"]=[];
  for(const exception of source.exceptions){
    if(!exception || !id(exception.invoiceId) || seen.has(exception.invoiceId) ||
       !["HIGH","NORMAL"].includes(exception.priority) ||
       !Array.isArray(exception.codes) || exception.codes.length<1 ||
       exception.codes.length>5 || new Set(exception.codes).size!==exception.codes.length ||
       exception.codes.some(code=>!codeSet.has(code)))
      return bad("F03_FINANCE_SOURCE_UNAVAILABLE");
    seen.add(exception.invoiceId);
    explanations.push({
      invoiceId:exception.invoiceId,priority:exception.priority,
      reasons:exception.codes.map(code=>({
        code,explanation:explanatoryRules[code][0],staffAction:explanatoryRules[code][1],
      })),
      humanApprovalRequired:true,
    });
  }
  return {ok:true,value:{
    state:"SAVED_LEDGER_EXCEPTION_EXPLANATION_FOR_OWNER_REVIEW",
    source:"DOUBLE_VERIFIED_AUTHORIZED_INVOICE_REVIEW",
    workspaceId:source.workspaceId,inspectedInvoiceCount:source.inspectedCount,
    exceptionCount:source.exceptionCount,explanations,
    ledgerSourceUnavailable:false,revenueAsserted:false,
    paymentConfirmed:false,refundAuthorized:false,invoiceWritten:false,
    customerMessageSent:false,modelInvoked:false,
  }};
}
