import {loadOperationalStaffSnapshot} from "@/features/operations/operational-product-runtime";
import {isFreshOwnerOperationsSnapshotAt} from "./owner-operations-brief";
import {planOwnerInvoiceExceptions, type FinanceReviewResult} from "./invoice-exception-review";

type Loader=typeof loadOperationalStaffSnapshot;
export interface AuthorizedFinanceReviewDependencies {
 loadSnapshot?:Loader;
 now?:()=>number;
}
export type AuthorizedFinanceReviewResult =
  | {ok:false;code:"FINANCE_INPUT_INVALID"|"FINANCE_OWNER_REQUIRED"|
    "FINANCE_SNAPSHOT_UNAVAILABLE"|"FINANCE_SAVED_STATE_CHANGED"}
  | {ok:true;value:Extract<FinanceReviewResult,{ok:true}>["value"] &
     {source:"AUTHORIZED_SAVED_INVOICE_SNAPSHOT"}};

const slugValid=(slug:unknown)=>typeof slug==="string" &&
  slug.length>=3 && slug.length<=40 &&
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);

function identity(snapshot:unknown, slug:string):snapshot is
  Extract<Awaited<ReturnType<Loader>>,{ok:true}> {
  if(!snapshot || typeof snapshot!=="object" ||
    !("ok" in snapshot) || snapshot.ok!==true)return false;
  const value=snapshot.value;
  return !!value && value.workspace.slug===slug &&
    typeof value.workspace.id==="string" &&
    value.workspace.id===value.actor.workspaceId &&
    typeof value.actor.userId==="string" &&
    value.actor.userId.length>0 && value.actor.role==="OWNER";
}
/** Only compare bounded authoritative invoice fields. PII, display strings
 * and customer contacts never participate in output or a model prompt. */
function ledgerFingerprint(s:Extract<Awaited<ReturnType<Loader>>,{ok:true}>["value"]):string {
 return JSON.stringify(s.invoices.map(i=>[
   i.id,i.workspaceId,i.status,i.currency,i.totalMinor,i.allocatedMinor,
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
  const source=planOwnerInvoiceExceptions({
    actor:{workspaceId:first.value.workspace.id,role:"OWNER"},
    workspaceId:first.value.workspace.id,invoices:first.value.invoices,
  });
  if(!source.ok)return {ok:false,code:"FINANCE_SNAPSHOT_UNAVAILABLE"};
  let second:Awaited<ReturnType<Loader>>;
  try{second=await load(workspaceSlug);}catch{return {ok:false,code:"FINANCE_SNAPSHOT_UNAVAILABLE"};}
  if(!identity(second,workspaceSlug) ||
     second.value.workspace.id!==first.value.workspace.id ||
     second.value.actor.userId!==first.value.actor.userId)
    return {ok:false,code:"FINANCE_OWNER_REQUIRED"};
  if(!isFreshOwnerOperationsSnapshotAt(second.value.loadedAt,now()) ||
     ledgerFingerprint(first.value)!==ledgerFingerprint(second.value))
    return {ok:false,code:"FINANCE_SAVED_STATE_CHANGED"};
  return {ok:true,value:{...source.value,source:"AUTHORIZED_SAVED_INVOICE_SNAPSHOT"}};
}
