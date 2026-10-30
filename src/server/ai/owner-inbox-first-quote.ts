import {resolveStaffActor,calculateOperationalQuote} from "@/features/operations/operational-product-runtime";
import {operationalDatabaseMode} from "@/features/auth/operational-preview-mode";

type Resolver=typeof resolveStaffActor;
type Read=Extract<Awaited<ReturnType<Resolver>>,{ok:true}>;
type Calculator=typeof calculateOperationalQuote;
export type InboxFirstQuoteResult=
 | {ok:false;code:"QUOTE_INPUT_INVALID"|"QUOTE_BACKEND_DISABLED"|"QUOTE_OWNER_REQUIRED"|
   "QUOTE_SOURCE_UNAVAILABLE"|"QUOTE_NOT_READY"|"QUOTE_ALREADY_EXISTS"|
   "QUOTE_SOURCE_CHANGED"|"QUOTE_PERSIST_FAILED"|"QUOTE_READBACK_UNVERIFIED"}
 | {ok:true;state:"FIRST_QUOTE_SAVED_VERIFIED";quoteId:string;quoteVersion:number;
    manualApprovalRequired:true;customerMessageSent:false;providerInvoked:false;
    bookingCreated:false;paymentChanged:false;preexistingQuotes:0};

export interface InboxFirstQuoteDeps{
 resolveActor?:Resolver;
 calculate?:Calculator;
 mode?:typeof operationalDatabaseMode;
}
const uuid=(v:unknown):v is string=>typeof v==="string"&&
 /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v);
const slug=(v:unknown):v is string=>typeof v==="string"&&
 v.length>=3&&v.length<=40&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v);
const fail=(code:Extract<InboxFirstQuoteResult,{ok:false}>["code"]):InboxFirstQuoteResult=>({ok:false,code});
function owner(input:Awaited<ReturnType<Resolver>>,value:string):input is Read{
 return input.ok&&input.value.workspace.slug===value&&uuid(input.value.workspace.id)&&
  uuid(input.value.actor.userId)&&input.value.actor.workspaceId===input.value.workspace.id&&
  input.value.actor.role==="OWNER"&&input.value.branchScope.mode==="ALL";
}
interface Source{requestId:string;branchId:string;fingerprint:string;quoteCount:0}
async function readSource(ctx:Read["value"],conversationId:string):Promise<Source|null>{
 const {workspace,service,branchScope}=ctx;
 const conv=await service.from("conversations")
  .select("id,workspace_id,branch_id,request_id,customer_id,version")
  .eq("workspace_id",workspace.id).eq("id",conversationId).maybeSingle();
 const c=conv.data;
 if(conv.error||!c||c.id!==conversationId||c.workspace_id!==workspace.id||
    !uuid(c.request_id)||!uuid(c.branch_id)||!Number.isSafeInteger(c.version)||
    c.version<1||!branchScope.branches.some(b=>b.id===c.branch_id))return null;
 const req=await service.from("requests")
  .select("id,workspace_id,branch_id,customer_id,status,version,service_id,bedrooms,bathrooms")
  .eq("workspace_id",workspace.id).eq("id",c.request_id).maybeSingle();
 const r=req.data;
 if(req.error||!r||r.id!==c.request_id||r.workspace_id!==workspace.id||
    r.branch_id!==c.branch_id||r.customer_id!==c.customer_id||
    !Number.isSafeInteger(r.version)||r.version<1||
    !["READY","NEEDS_REVIEW"].includes(r.status)||
    !uuid(r.service_id)||!Number.isSafeInteger(r.bedrooms)||
    !Number.isSafeInteger(r.bathrooms)||
    r.bedrooms<0||r.bedrooms>10||r.bathrooms<0||r.bathrooms>10)return null;
 // An earlier quote, including a superseded quote, means use the authoritative
 // quote renewal path. Never claim an initial offer or reprice an old one.
 const quotes=await service.from("quotes").select("id")
  .eq("workspace_id",workspace.id).eq("request_id",r.id).limit(2);
 if(quotes.error||!Array.isArray(quotes.data)||quotes.data.length!==0)return null;
 return {requestId:r.id,branchId:r.branch_id,quoteCount:0,
  fingerprint:JSON.stringify([c.id,c.workspace_id,c.branch_id,c.request_id,
    c.customer_id,c.version,r.id,r.workspace_id,r.branch_id,r.customer_id,
    r.status,r.version,r.service_id,r.bedrooms,r.bathrooms])};
}
/**
 * Owner's explicit first-quote calculation from selected saved Inbox thread.
 * Uses the existing real owner rate-card + quote persistence engine, never
 * a new/duplicate price implementation. This is NOT a concurrency-safe
 * first-quote reservation: concurrent independent owner clicks can race
 * at the existing quote RPC boundary, so only exact post-write row proof
 * establishes a verified result. Production must vet that database lock.
 */
export async function calculateOwnerInboxFirstQuote(
 workspaceSlug:string,conversationId:string,deps:InboxFirstQuoteDeps={},
):Promise<InboxFirstQuoteResult>{
 if(!slug(workspaceSlug)||!uuid(conversationId))return fail("QUOTE_INPUT_INVALID");
 if((deps.mode??operationalDatabaseMode)()!=="SERVICE_ROLE")return fail("QUOTE_BACKEND_DISABLED");
 const resolve=deps.resolveActor??resolveStaffActor;
 let first:Awaited<ReturnType<Resolver>>;
 try{first=await resolve(workspaceSlug);}catch{return fail("QUOTE_OWNER_REQUIRED");}
 if(!owner(first,workspaceSlug))return fail("QUOTE_OWNER_REQUIRED");
 let before:Source|null;
 try{before=await readSource(first.value,conversationId);}
 catch{return fail("QUOTE_SOURCE_UNAVAILABLE");}
 if(!before)return fail("QUOTE_NOT_READY");
 let second:Awaited<ReturnType<Resolver>>;
 try{second=await resolve(workspaceSlug);}catch{return fail("QUOTE_SOURCE_CHANGED");}
 if(!owner(second,workspaceSlug)||
    second.value.workspace.id!==first.value.workspace.id||
    second.value.actor.userId!==first.value.actor.userId||
    !second.value.branchScope.branches.some(b=>b.id===before?.branchId))
    return fail("QUOTE_SOURCE_CHANGED");
 let again:Source|null;
 try{again=await readSource(second.value,conversationId);}
 catch{return fail("QUOTE_SOURCE_CHANGED");}
 if(!again||again.fingerprint!==before.fingerprint||again.requestId!==before.requestId)
  return fail("QUOTE_SOURCE_CHANGED");
 // No extra add-on consent from this Inbox action; the existing calculator
 // loads authoritative branch prices and performs its own actor validation.
 let calculated:Awaited<ReturnType<Calculator>>;
 try{calculated=await (deps.calculate??calculateOperationalQuote)(
  workspaceSlug,before.requestId,{oven:false});}
 catch{return fail("QUOTE_PERSIST_FAILED");}
 if(!calculated.ok)return fail("QUOTE_PERSIST_FAILED");
 let third:Awaited<ReturnType<Resolver>>;
 try{third=await resolve(workspaceSlug);}catch{return fail("QUOTE_READBACK_UNVERIFIED");}
 if(!owner(third,workspaceSlug)||third.value.workspace.id!==first.value.workspace.id||
    third.value.actor.userId!==first.value.actor.userId||
    !third.value.branchScope.branches.some(b=>b.id===before?.branchId))
   return fail("QUOTE_READBACK_UNVERIFIED");
 try{
  const result=await third.value.service.from("quotes")
   .select("id,workspace_id,request_id,status,version,currency,total_minor,subtotal_minor,tax_minor,deposit_minor,balance_minor,duration_minutes")
   .eq("workspace_id",third.value.workspace.id).eq("request_id",before.requestId)
   .limit(2);
  if(result.error||!Array.isArray(result.data)||result.data.length!==1)
   return fail("QUOTE_READBACK_UNVERIFIED");
  const q=result.data[0];
  if(!uuid(q.id)||q.workspace_id!==third.value.workspace.id||
    q.request_id!==before.requestId||
    !["DRAFT","PENDING_APPROVAL"].includes(q.status)||
    !Number.isSafeInteger(q.version)||q.version<1||
    !/^[A-Z]{3}$/.test(String(q.currency))||
    ![q.total_minor,q.subtotal_minor,q.tax_minor,q.deposit_minor,
      q.balance_minor,q.duration_minutes].every(n=>Number.isSafeInteger(n)&&n>=0)||
    q.subtotal_minor+q.tax_minor!==q.total_minor||
    q.deposit_minor+q.balance_minor!==q.total_minor||
    q.duration_minutes<1)return fail("QUOTE_READBACK_UNVERIFIED");
  return {ok:true,state:"FIRST_QUOTE_SAVED_VERIFIED",quoteId:q.id,
   quoteVersion:q.version,preexistingQuotes:0,manualApprovalRequired:true,
   customerMessageSent:false,providerInvoked:false,bookingCreated:false,paymentChanged:false};
 }catch{return fail("QUOTE_READBACK_UNVERIFIED");}
}
