import {loadOperationalStaffSnapshot, type OperationalInvoice} from "@/features/operations/operational-product-runtime";
import type {InvoiceDTO} from "@/contracts";
import {isFreshOwnerOperationsSnapshotAt} from "./owner-operations-brief";
import {planOwnerInvoiceExceptions, type FinanceReviewResult} from "./invoice-exception-review";

type Loader=typeof loadOperationalStaffSnapshot;
export interface AuthorizedFinanceReviewDependencies {
 loadSnapshot?:Loader;
 now?:()=>number;
}
export type AuthorizedFinanceReviewResult =
  | {ok:false;code:"FINANCE_INPUT_INVALID"|"FINANCE_OWNER_REQUIRED"|
    "FINANCE_SNAPSHOT_UNAVAILABLE"|"FINANCE_SAVED_STATE_CHANGED"|
    "FINANCE_SOURCE_INCOMPLETE"}
  | {ok:true;value:Omit<Extract<FinanceReviewResult,{ok:true}>["value"],"source"> &
     {source:"AUTHORIZED_SAVED_INVOICE_SNAPSHOT"}};

const slugValid=(slug:unknown)=>typeof slug==="string" &&
  slug.length>=3 && slug.length<=40 &&
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);

function identity(snapshot:Awaited<ReturnType<Loader>>, slug:string):snapshot is
  Extract<Awaited<ReturnType<Loader>>,{ok:true}> {
  if(!snapshot.ok)return false;
  const value=snapshot.value;
  return !!value && value.workspace.slug===slug &&
    typeof value.workspace.id==="string" &&
    value.workspace.id===value.actor.workspaceId &&
    typeof value.actor.userId==="string" &&
    value.actor.userId.length>0 && value.actor.role==="OWNER";
}
// OperationalInvoice is a UI DTO, not the narrower finance planner contract.
// Reject unknown, hidden and accessor properties before dropping quoteId. An
// unchecked object spread would admit customer contacts and payment assertions.
const INVOICE_SOURCE_KEYS=new Set([
 "id","workspaceId","quoteId","visitId","status","currency",
 "totalMinor","allocatedMinor","refundedMinor","balanceMinor",
]);
function projectSavedInvoiceRows(rows:unknown):InvoiceDTO[]|null {
 if(!Array.isArray(rows) || rows.length>=300 ||
    Object.getPrototypeOf(rows)!==Array.prototype ||
    Reflect.ownKeys(rows).length!==rows.length+1)return null;
 const projected:InvoiceDTO[]=[];
 for(const value of rows as unknown[]){
   if(!value || typeof value!=="object" || Array.isArray(value))return null;
   try {
     if(Object.getPrototypeOf(value)!==Object.prototype ||
       Object.getOwnPropertySymbols(value).length!==0 ||
       Object.getOwnPropertyNames(value).length!==Object.keys(value).length ||
       !Object.keys(value).every(key=>INVOICE_SOURCE_KEYS.has(key)) ||
       !Object.values(Object.getOwnPropertyDescriptors(value))
         .every(desc=>Object.hasOwn(desc,"value")))return null;
     const row=value as OperationalInvoice;
     if((row.quoteId!==undefined && typeof row.quoteId!=="string") ||
        (row.visitId!==undefined && typeof row.visitId!=="string"))return null;
     projected.push({
       id:row.id,workspaceId:row.workspaceId,visitId:row.visitId,
       status:row.status,currency:row.currency,totalMinor:row.totalMinor,
       allocatedMinor:row.allocatedMinor,refundedMinor:row.refundedMinor,
       balanceMinor:row.balanceMinor,
     });
   } catch {return null;}
 }
 return projected;
}

/** Only compare bounded authoritative invoice fields. PII, display strings
 * and customer contacts never participate in output or a model prompt. */
function ledgerFingerprint(s:Extract<Awaited<ReturnType<Loader>>,{ok:true}>["value"]):string {
 return JSON.stringify(s.invoices.map(i=>[
   i.id,i.workspaceId,i.quoteId,i.visitId,i.status,i.currency,i.totalMinor,i.allocatedMinor,
   i.refundedMinor,i.balanceMinor,
 ]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))));
}

/** Signed-in owner-only saved source, twice verified; never calls a model,
 * schedules a reminder, confirms payment or contacts customers. */
export async function loadAuthorizedOwnerFinanceReview(
  workspaceSlug:string,
  deps:AuthorizedFinanceReviewDependencies={},
):Promise<AuthorizedFinanceReviewResult>{
  if(!slugValid(workspaceSlug))return {ok:false,code:"FINANCE_INPUT_INVALID"};
  const load=deps.loadSnapshot??loadOperationalStaffSnapshot;
  const now=deps.now??Date.now;
  let first:Awaited<ReturnType<Loader>>;
  try{first=await load(workspaceSlug);}catch{return {ok:false,code:"FINANCE_SNAPSHOT_UNAVAILABLE"};}
  if(!identity(first,workspaceSlug))return {ok:false,code:"FINANCE_OWNER_REQUIRED"};
  if(!isFreshOwnerOperationsSnapshotAt(first.value.loadedAt,now()))
    return {ok:false,code:"FINANCE_SNAPSHOT_UNAVAILABLE"};
  // The operational loader fetches at most 300 saved invoice rows. An
  // exactly-full page is not proof that there are no more invoices. Never
  // report an authoritative "all-clear" from truncated financial evidence.
  if(!Array.isArray(first.value.invoices) || first.value.invoices.length>=300)
    return {ok:false,code:"FINANCE_SOURCE_INCOMPLETE"};
  const firstLedger=projectSavedInvoiceRows(first.value.invoices);
  if(!firstLedger)return {ok:false,code:"FINANCE_SNAPSHOT_UNAVAILABLE"};
  const source=planOwnerInvoiceExceptions({
    actor:{workspaceId:first.value.workspace.id,role:"OWNER"},
    workspaceId:first.value.workspace.id,invoices:firstLedger,
  });
  if(!source.ok)return {ok:false,code:"FINANCE_SNAPSHOT_UNAVAILABLE"};
  let second:Awaited<ReturnType<Loader>>;
  try{second=await load(workspaceSlug);}catch{return {ok:false,code:"FINANCE_SNAPSHOT_UNAVAILABLE"};}
  if(!identity(second,workspaceSlug) ||
     second.value.workspace.id!==first.value.workspace.id ||
     second.value.actor.userId!==first.value.actor.userId)
    return {ok:false,code:"FINANCE_OWNER_REQUIRED"};
  if(!Array.isArray(second.value.invoices) || second.value.invoices.length>=300)
    return {ok:false,code:"FINANCE_SOURCE_INCOMPLETE"};
  if(!projectSavedInvoiceRows(second.value.invoices))
    return {ok:false,code:"FINANCE_SAVED_STATE_CHANGED"};
  if(!isFreshOwnerOperationsSnapshotAt(second.value.loadedAt,now()))
    return {ok:false,code:"FINANCE_SAVED_STATE_CHANGED"};
  try {
    if(ledgerFingerprint(first.value)!==ledgerFingerprint(second.value))
      return {ok:false,code:"FINANCE_SAVED_STATE_CHANGED"};
  } catch {return {ok:false,code:"FINANCE_SAVED_STATE_CHANGED"};}
  return {ok:true,value:{...source.value,source:"AUTHORIZED_SAVED_INVOICE_SNAPSHOT"}};
}
