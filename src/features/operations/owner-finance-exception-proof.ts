/** Browser display contract for the protected, OWNER-only saved-ledger
 * exception reader. This module does not call a model, use money amounts,
 * authorize payments/refunds or load customer identities.
 */
export const ownerFinanceCodes=[
 "LEDGER_TOTALS_RECONCILIATION","ISSUED_BALANCE_REVIEW",
 "PARTIAL_BALANCE_REVIEW","PAID_STATUS_LEDGER_CONFLICT",
 "VOID_REMAINDER_REVIEW",
] as const;
export type OwnerFinanceCode=typeof ownerFinanceCodes[number];
export type OwnerFinancePriority="HIGH"|"NORMAL";
export type OwnerFinanceException={
 invoiceId:string;codes:OwnerFinanceCode[];priority:OwnerFinancePriority;
};
export interface VerifiedOwnerFinanceExceptions {
 state:"FINANCE_OWNER_MANUAL_REVIEW";
 source:"AUTHORIZED_SAVED_INVOICE_SNAPSHOT";
 workspaceId:string;
 inspectedCount:number;
 exceptionCount:number;
 exceptions:OwnerFinanceException[];
 paymentConfirmed:false;refundAuthorized:false;providerMessageQueued:false;
}
const plain=(x:unknown):x is Record<string,unknown>=>
  x!==null&&typeof x==="object"&&!Array.isArray(x)&&
  Object.getPrototypeOf(x)===Object.prototype&&
  Reflect.ownKeys(x).length===Object.keys(x).length;
const keys=(x:Record<string,unknown>,allowed:readonly string[])=>
  Object.keys(x).length===allowed.length&&
  allowed.every(k=>Object.hasOwn(x,k));
const validId=(x:unknown):x is string=>typeof x==="string"&&
  /^[A-Za-z0-9:_-]{3,128}$/.test(x);
const count=(x:unknown):x is number=>typeof x==="number"&&
  Number.isSafeInteger(x)&&x>=0&&x<300;
const highCodes=new Set<OwnerFinanceCode>([
  "LEDGER_TOTALS_RECONCILIATION","PAID_STATUS_LEDGER_CONFLICT",
]);
export const ownerFinanceCodeLabels:Readonly<Record<OwnerFinanceCode,string>>={
 LEDGER_TOTALS_RECONCILIATION:"Ledger figures do not reconcile",
 ISSUED_BALANCE_REVIEW:"Issued invoice has collectible balance",
 PARTIAL_BALANCE_REVIEW:"Partial payment needs manual balance review",
 PAID_STATUS_LEDGER_CONFLICT:"Paid status conflicts with saved balance",
 VOID_REMAINDER_REVIEW:"Void invoice has outstanding balance",
};
export function parseOwnerFinanceExceptions(value:unknown):
  VerifiedOwnerFinanceExceptions|null {
 if(!plain(value)||!keys(value,["state","source","workspaceId","inspectedCount",
   "exceptionCount","exceptions","paymentConfirmed","refundAuthorized",
   "providerMessageQueued"])||
   value.state!=="FINANCE_OWNER_MANUAL_REVIEW"||
   value.source!=="AUTHORIZED_SAVED_INVOICE_SNAPSHOT"||
   !validId(value.workspaceId)||!count(value.inspectedCount)||
   !count(value.exceptionCount)||
   value.exceptionCount>value.inspectedCount||
   value.paymentConfirmed!==false||value.refundAuthorized!==false||
   value.providerMessageQueued!==false||!Array.isArray(value.exceptions)||
   value.exceptions.length!==value.exceptionCount)return null;
 const seen=new Set<string>();
 const exceptions:OwnerFinanceException[]=[];
 let prevPriority=-1,prevId="";
 for(const entry of value.exceptions){
   if(!plain(entry)||!keys(entry,["invoiceId","codes","priority"])||
      !validId(entry.invoiceId)||seen.has(entry.invoiceId)||
      !Array.isArray(entry.codes)||entry.codes.length<1||
      entry.codes.length>ownerFinanceCodes.length||
      !entry.codes.every((c:unknown):c is OwnerFinanceCode=>
        typeof c==="string"&&ownerFinanceCodes.includes(c as OwnerFinanceCode))||
      new Set(entry.codes).size!==entry.codes.length||
      (entry.priority!=="HIGH"&&entry.priority!=="NORMAL"))return null;
   const priority=entry.codes.some((c:OwnerFinanceCode)=>highCodes.has(c))?"HIGH":"NORMAL";
   if(priority!==entry.priority)return null;
   const rank=priority==="HIGH"?0:1;
   // The canonical backend orders by severity then by stable invoice ID.
   if(rank<prevPriority||(rank===prevPriority&&entry.invoiceId.localeCompare(prevId)<0))
     return null;
   prevPriority=rank;prevId=entry.invoiceId;
   seen.add(entry.invoiceId);
   exceptions.push({invoiceId:entry.invoiceId,priority,codes:[...entry.codes]});
 }
 return {
   state:"FINANCE_OWNER_MANUAL_REVIEW",
   source:"AUTHORIZED_SAVED_INVOICE_SNAPSHOT",
   workspaceId:value.workspaceId,inspectedCount:value.inspectedCount,
   exceptionCount:value.exceptionCount,exceptions,
   paymentConfirmed:false,refundAuthorized:false,providerMessageQueued:false,
 };
}
