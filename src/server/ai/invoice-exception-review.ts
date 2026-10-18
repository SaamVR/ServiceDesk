import type { InvoiceDTO } from "../../contracts";
import { isVerifiedStaffCollectibleInvoice } from "@/features/operations/staff-invoice-collection-readiness";

export type FinanceReviewCode =
  | "LEDGER_TOTALS_RECONCILIATION"
  | "ISSUED_BALANCE_REVIEW"
  | "PARTIAL_BALANCE_REVIEW"
  | "PAID_STATUS_LEDGER_CONFLICT"
  | "VOID_REMAINDER_REVIEW";

export interface FinanceReviewInput {
  workspaceId:string;
  actor:{workspaceId:string;role:"OWNER"|"DISPATCHER"|"CREW"|"CUSTOMER"};
  invoices:readonly InvoiceDTO[];
}

export type FinanceReviewResult =
  | {ok:false;code:"FINANCE_SCOPE_INVALID"|"FINANCE_SOURCE_INVALID"}
  | {ok:true;value:{
    state:"FINANCE_OWNER_MANUAL_REVIEW";
    workspaceId:string;
    source:"SAVED_INVOICE_LEDGER_ONLY";
    inspectedCount:number;
    exceptionCount:number;
    exceptions:Array<{invoiceId:string;codes:FinanceReviewCode[];priority:"HIGH"|"NORMAL"}>;
    paymentConfirmed:false;
    refundAuthorized:false;
    providerMessageQueued:false;
  }};

const validId=(v:unknown):v is string=>
  typeof v==="string" && /^[A-Za-z0-9:_-]{3,128}$/.test(v);

function savedInvoiceRecord(value:unknown):boolean {
  if(!value || typeof value!=="object" || Array.isArray(value) ||
     Object.getPrototypeOf(value)!==Object.prototype ||
     Object.getOwnPropertySymbols(value).length!==0 ||
     Object.getOwnPropertyNames(value).length!==Object.keys(value).length)
    return false;
  const descriptors=Object.getOwnPropertyDescriptors(value);
  // Hidden properties, accessors and prototype data are not trusted saved
  // ledger source. They can conceal business-relevant facts from UI review.
  if(Object.values(descriptors).some(desc=>!Object.hasOwn(desc,"value")))
    return false;
  const allowed=new Set(["id","workspaceId","visitId","status","currency",
    "totalMinor","allocatedMinor","refundedMinor","balanceMinor"]);
  return Object.keys(value).every(key=>allowed.has(key));
}

/** No model reads raw invoice amounts, and paid-looking statuses are never
 * accepted as Stripe proof. The operator decides every financial action. */
export function planOwnerInvoiceExceptions(input:FinanceReviewInput):FinanceReviewResult {
  const {workspaceId,actor,invoices}=input??{};
  if(!actor || actor.workspaceId!==workspaceId ||
      actor.role!=="OWNER" || !validId(workspaceId))
    return {ok:false,code:"FINANCE_SCOPE_INVALID"};
  if(!Array.isArray(invoices) || invoices.length>=500 ||
     Reflect.ownKeys(invoices).length!==invoices.length+1 ||
     invoices.some(item=>!savedInvoiceRecord(item)))
    return {ok:false,code:"FINANCE_SOURCE_INVALID"};
  const seen=new Set<string>();
  const exceptions:Extract<FinanceReviewResult,{ok:true}>["value"]["exceptions"]=[];
  for(const invoice of invoices){
    if(!invoice || invoice.workspaceId!==workspaceId ||
        !validId(invoice.id) || seen.has(invoice.id) ||
        !["DRAFT","ISSUED","PARTIALLY_PAID","PAID","VOID"].includes(invoice.status) ||
        typeof invoice.currency!=="string" || !/^[A-Z]{3}$/.test(invoice.currency)) {
      return {ok:false,code:"FINANCE_SOURCE_INVALID"};
    }
    seen.add(invoice.id);
    const amounts=[invoice.totalMinor,invoice.allocatedMinor,invoice.refundedMinor,invoice.balanceMinor];
    const valid=amounts.every(n=>typeof n==="number" && Number.isSafeInteger(n) && n>=0) &&
      invoice.allocatedMinor>=invoice.refundedMinor &&
      Number.isSafeInteger(invoice.allocatedMinor-invoice.refundedMinor+invoice.balanceMinor) &&
      invoice.allocatedMinor-invoice.refundedMinor+invoice.balanceMinor===invoice.totalMinor;
    const codes:FinanceReviewCode[]=[];
    if(!valid){
      codes.push("LEDGER_TOTALS_RECONCILIATION");
    } else if(invoice.status==="ISSUED" &&
        isVerifiedStaffCollectibleInvoice(invoice)){
      codes.push("ISSUED_BALANCE_REVIEW");
    } else if(invoice.status==="PARTIALLY_PAID" &&
        isVerifiedStaffCollectibleInvoice(invoice)){
      codes.push("PARTIAL_BALANCE_REVIEW");
    } else if(invoice.status==="PAID" && invoice.balanceMinor!==0){
      codes.push("PAID_STATUS_LEDGER_CONFLICT");
    } else if(invoice.status==="VOID" && invoice.balanceMinor!==0){
      codes.push("VOID_REMAINDER_REVIEW");
    }
    if(codes.length) exceptions.push({
      invoiceId:invoice.id,codes,
      priority:codes.some(c=>c==="LEDGER_TOTALS_RECONCILIATION" ||
        c==="PAID_STATUS_LEDGER_CONFLICT")?"HIGH":"NORMAL",
    });
  }
  exceptions.sort((a,b)=>Number(b.priority==="HIGH")-Number(a.priority==="HIGH") ||
    a.invoiceId.localeCompare(b.invoiceId));
  return {ok:true,value:{
    state:"FINANCE_OWNER_MANUAL_REVIEW",
    workspaceId,source:"SAVED_INVOICE_LEDGER_ONLY",
    inspectedCount:invoices.length,exceptionCount:exceptions.length,exceptions,
    paymentConfirmed:false,refundAuthorized:false,providerMessageQueued:false,
  }};
}
