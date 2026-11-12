import {resolveStaffActor} from "@/features/operations/operational-product-runtime";
import {operationalDatabaseMode} from "@/features/auth/operational-preview-mode";
type Resolver=typeof resolveStaffActor;
type Actor=Extract<Awaited<ReturnType<Resolver>>,{ok:true}>["value"];
const uuid=(v:unknown):v is string=>typeof v==="string"&&
 /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v);
const slug=(v:unknown):v is string=>typeof v==="string"&&v.length>=3&&v.length<=40&&
 /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v);
const positive=(v:unknown):v is number=>typeof v==="number"&&Number.isSafeInteger(v)&&v>0;
const nonnegative=(v:unknown):v is number=>typeof v==="number"&&Number.isSafeInteger(v)&&v>=0;
const statusSet=new Set(["SCHEDULED","ASSIGNED","EN_ROUTE","IN_PROGRESS","NEEDS_REVIEW","COMPLETED"]);
export type SavedBookingReceipt=
 | {ok:false;code:"INVALID_INPUT"|"BACKEND_UNAVAILABLE"|"OWNER_REQUIRED"|"SAVED_BOOKING_UNVERIFIED"|"SOURCE_CHANGED"}
 | {ok:true;value:{
     state:"SAVED_BOOKING_WITH_APPLIED_DEPOSIT";
     quoteId:string;visitId:string;invoiceId:string;
     startsAt:string;visitStatus:string;quoteVersion:number;invoiceStatus:string;
     evidence:"TWO_OWNER_AUTHORIZED_SAVED_RECORD_READS";
     recordedDepositApplication:true;bookingRecordPresent:true;
     customerMessageSent:false;newPaymentProcessed:false;newBookingCreated:false;
     manualReviewRecommended:true;
 }};
interface ReceiptFacts{
 workspaceId:string;branchId:string;quoteId:string;quoteVersion:number;
 visitId:string;invoiceId:string;startsAt:string;visitStatus:string;invoiceStatus:string;
 fingerprint:string;
}
type Reader=(actor:Actor,quoteId:string)=>Promise<ReceiptFacts|null>;
export interface SavedBookingReceiptDeps{resolveActor?:Resolver;read?:Reader;mode?:typeof operationalDatabaseMode}
function owner(r:Awaited<ReturnType<Resolver>>,workspaceSlug:string):r is Extract<Awaited<ReturnType<Resolver>>,{ok:true}>{
 return r.ok&&r.value.workspace.slug===workspaceSlug&&uuid(r.value.workspace.id)&&
 uuid(r.value.actor.userId)&&r.value.actor.workspaceId===r.value.workspace.id&&
 r.value.actor.role==="OWNER"&&r.value.branchScope.mode==="ALL";
}
/** Fully read-only: a staff Inbox snapshot has neither complete provider
 * payment evidence nor sufficient cardinality to prove booking. */
async function readSavedBooking(actor:Actor,quoteId:string):Promise<ReceiptFacts|null>{
 const {workspace,service,branchScope}=actor;
 const quote=await service.from("quotes").select("id,workspace_id,request_id,status,version,deposit_minor,currency")
  .eq("workspace_id",workspace.id).eq("id",quoteId).maybeSingle();
 const q=quote.data;
 if(quote.error||!q||q.id!==quoteId||q.workspace_id!==workspace.id||
  !uuid(q.request_id)||q.status!=="ACCEPTED"||!positive(q.version)||
  !positive(q.deposit_minor)||!(/^[A-Z]{3}$/).test(String(q.currency)))return null;
 const request=await service.from("requests").select("id,workspace_id,branch_id")
  .eq("workspace_id",workspace.id).eq("id",q.request_id).maybeSingle();
 const r=request.data;
 if(request.error||!r||r.id!==q.request_id||r.workspace_id!==workspace.id||
  !uuid(r.branch_id)||!branchScope.branches.some(b=>b.id===r.branch_id))return null;
 const visits=await service.from("visits")
  .select("id,workspace_id,request_id,quote_id,hold_id,slot_id,crew_id,status,starts_at,ends_at,version")
  .eq("workspace_id",workspace.id).eq("quote_id",quoteId).limit(2);
 if(visits.error||!Array.isArray(visits.data)||visits.data.length!==1)return null;
 const v=visits.data[0];
 if(!uuid(v.id)||v.workspace_id!==workspace.id||v.request_id!==r.id||
   v.quote_id!==quoteId||!uuid(v.hold_id)||!uuid(v.slot_id)||!uuid(v.crew_id)||
   !statusSet.has(v.status)||!positive(v.version)||
   typeof v.starts_at!=="string"||!Number.isFinite(Date.parse(v.starts_at))||
   typeof v.ends_at!=="string"||!Number.isFinite(Date.parse(v.ends_at))||
   Date.parse(v.ends_at)<=Date.parse(v.starts_at))return null;
 const hold=await service.from("slot_holds").select("id,workspace_id,slot_id,quote_id,status")
  .eq("workspace_id",workspace.id).eq("id",v.hold_id).maybeSingle();
 const h=hold.data;
 if(hold.error||!h||h.id!==v.hold_id||h.workspace_id!==workspace.id||
   h.quote_id!==quoteId||h.slot_id!==v.slot_id||h.status!=="CONFIRMED")return null;
 const slot=await service.from("capacity_slots").select("id,workspace_id,crew_id,starts_at,ends_at")
  .eq("workspace_id",workspace.id).eq("id",v.slot_id).maybeSingle();
 const sl=slot.data;
 if(slot.error||!sl||sl.id!==v.slot_id||sl.workspace_id!==workspace.id||
    sl.crew_id!==v.crew_id||sl.starts_at!==v.starts_at||
    !Number.isFinite(Date.parse(String(sl.ends_at)))||
    Date.parse(sl.ends_at)<Date.parse(v.ends_at))return null;
 const crew=await service.from("crews").select("id,workspace_id,branch_id")
  .eq("workspace_id",workspace.id).eq("id",v.crew_id).maybeSingle();
 if(crew.error||!crew.data||crew.data.id!==v.crew_id||
    crew.data.workspace_id!==workspace.id||crew.data.branch_id!==r.branch_id)return null;
 const invoices=await service.from("invoices")
  .select("id,workspace_id,quote_id,visit_id,status,currency,total_minor,allocated_minor,refunded_minor,balance_minor")
  .eq("workspace_id",workspace.id).eq("quote_id",quoteId).limit(2);
 if(invoices.error||!Array.isArray(invoices.data)||invoices.data.length!==1)return null;
 const invoice=invoices.data[0];
 if(!uuid(invoice.id)||invoice.workspace_id!==workspace.id||
   invoice.quote_id!==quoteId||invoice.visit_id!==v.id||
   !["PAID","PARTIALLY_PAID"].includes(invoice.status)||
   invoice.currency!==q.currency||
   ![invoice.total_minor,invoice.allocated_minor,invoice.refunded_minor,invoice.balance_minor].every(nonnegative)||
   invoice.allocated_minor<invoice.refunded_minor||
   invoice.allocated_minor-invoice.refunded_minor<q.deposit_minor||
   invoice.allocated_minor-invoice.refunded_minor+invoice.balance_minor!==invoice.total_minor)
   return null;
 const payments=await service.from("verified_payment_applications")
  .select("id,workspace_id,quote_id,hold_id,invoice_id,purpose,state,amount_minor,currency")
  .eq("workspace_id",workspace.id).eq("quote_id",quoteId)
  .eq("purpose","DEPOSIT").eq("state","APPLIED").limit(2);
 if(payments.error||!Array.isArray(payments.data)||payments.data.length!==1)return null;
 const p=payments.data[0];
 if(!uuid(p.id)||p.workspace_id!==workspace.id||p.quote_id!==quoteId||
    p.hold_id!==h.id||p.invoice_id!==invoice.id||p.purpose!=="DEPOSIT"||
    p.state!=="APPLIED"||p.amount_minor!==q.deposit_minor||p.currency!==q.currency)return null;
 const facts=[workspace.id,r.branch_id,q,v,h,sl,crew.data,invoice,p];
 return {workspaceId:workspace.id,branchId:r.branch_id,quoteId,
  quoteVersion:q.version,visitId:v.id,invoiceId:invoice.id,
  startsAt:v.starts_at,visitStatus:v.status,invoiceStatus:invoice.status,
  fingerprint:JSON.stringify(facts)};
}
/** Requires TWO independent authorizations and TWO fully reconciled saved
 * provider/deposit/visit reads. No provider is invoked and no new write occurs. */
export async function loadOwnerSavedBookingReceipt(workspaceSlug:string,quoteId:string,
 deps:SavedBookingReceiptDeps={}):Promise<SavedBookingReceipt>{
 if(!slug(workspaceSlug)||!uuid(quoteId))return{ok:false,code:"INVALID_INPUT"};
 if((deps.mode??operationalDatabaseMode)()!=="SERVICE_ROLE")return{ok:false,code:"BACKEND_UNAVAILABLE"};
 const resolve=deps.resolveActor??resolveStaffActor,read=deps.read??readSavedBooking;
 let a:Awaited<ReturnType<Resolver>>;
 try{a=await resolve(workspaceSlug);}catch{return{ok:false,code:"OWNER_REQUIRED"};}
 if(!owner(a,workspaceSlug))return{ok:false,code:"OWNER_REQUIRED"};
 let first:ReceiptFacts|null;
 try{first=await read(a.value,quoteId);}catch{return{ok:false,code:"SAVED_BOOKING_UNVERIFIED"};}
 if(!first||first.workspaceId!==a.value.workspace.id||first.quoteId!==quoteId||
    !a.value.branchScope.branches.some(b=>b.id===first?.branchId))
    return{ok:false,code:"SAVED_BOOKING_UNVERIFIED"};
 let b:Awaited<ReturnType<Resolver>>;
 try{b=await resolve(workspaceSlug);}catch{return{ok:false,code:"SOURCE_CHANGED"};}
 if(!owner(b,workspaceSlug)||b.value.workspace.id!==a.value.workspace.id||
   b.value.actor.userId!==a.value.actor.userId||
   !b.value.branchScope.branches.some(x=>x.id===first?.branchId))return{ok:false,code:"SOURCE_CHANGED"};
 let second:ReceiptFacts|null;
 try{second=await read(b.value,quoteId);}catch{return{ok:false,code:"SOURCE_CHANGED"};}
 if(!second||second.fingerprint!==first.fingerprint||
  second.quoteId!==quoteId||second.workspaceId!==a.value.workspace.id||
  second.branchId!==first.branchId||second.visitId!==first.visitId||
  second.invoiceId!==first.invoiceId)return{ok:false,code:"SOURCE_CHANGED"};
 return{ok:true,value:{
  state:"SAVED_BOOKING_WITH_APPLIED_DEPOSIT",
  quoteId,visitId:second.visitId,invoiceId:second.invoiceId,
  startsAt:second.startsAt,visitStatus:second.visitStatus,
  quoteVersion:second.quoteVersion,invoiceStatus:second.invoiceStatus,
  evidence:"TWO_OWNER_AUTHORIZED_SAVED_RECORD_READS",
  recordedDepositApplication:true,bookingRecordPresent:true,
  customerMessageSent:false,newPaymentProcessed:false,newBookingCreated:false,
  manualReviewRecommended:true,
 }};
}
