import {resolveStaffActor,transitionOperationalVisit} from "@/features/operations/operational-product-runtime";
import {operationalDatabaseMode} from "@/features/auth/operational-preview-mode";
import {loadOwnerSavedBookingReceipt} from "@/server/ai/owner-saved-booking-receipt";

type ActorResolver=typeof resolveStaffActor;
type ReceiptLoader=typeof loadOwnerSavedBookingReceipt;
type VisitTransition=typeof transitionOperationalVisit;
const uuid=(v:unknown):v is string=>typeof v==="string"&&
 /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v);
const slug=(v:unknown):v is string=>typeof v==="string"&&
 v.length>=3&&v.length<=40&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v);
export type OwnerDispatchResult=
 | {ok:false;code:"NOT_ACTIVATED"|"INVALID_SELECTION"|"OWNER_REQUIRED"|
  "BOOKING_UNVERIFIED"|"VISIT_NOT_SCHEDULED"|"SOURCE_CHANGED"|
  "DISPATCH_REJECTED"|"POST_WRITE_UNVERIFIED"}
 | {ok:true;state:"SAVED_VISIT_ASSIGNED_VERIFIED";quoteId:string;visitId:string;
  invoiceId:string;visitStatus:"ASSIGNED";providerDeliveryVerified:false;
  customerMessaged:false;paymentProcessed:false;newBookingCreated:false;
  calendarOutboxMayBeQueued:true};

export interface OwnerDispatchDeps{
 enabled?:()=>boolean;
 mode?:typeof operationalDatabaseMode;
 resolve?:ActorResolver;
 loadBooking?:ReceiptLoader;
 transition?:VisitTransition;
}
const fail=(code:Extract<OwnerDispatchResult,{ok:false}>["code"]):OwnerDispatchResult=>({ok:false,code});
type Owner=Extract<Awaited<ReturnType<ActorResolver>>,{ok:true}>;
function authorized(result:Awaited<ReturnType<ActorResolver>>,workspaceSlug:string):result is Owner{
 return result.ok&&result.value.workspace.slug===workspaceSlug&&
  uuid(result.value.workspace.id)&&uuid(result.value.actor.userId)&&
  result.value.actor.workspaceId===result.value.workspace.id&&
  result.value.actor.role==="OWNER"&&result.value.branchScope.mode==="ALL"&&
  result.value.branchScope.branches.length>0;
}
/** Human-only visit state transition, NOT booking creation.
 * Existing verified-deposit RPC supplies payment+visit atomicity.
 * Existing transitionVisit('ASSIGN') can persist a calendar outbox event;
 * it must NEVER be described as proof that a provider delivered that event.
 * Explicit rollout disabled by default. Failed post-write proof may mean
 * a dispatch was committed: the caller must not automatically retry. */
export async function dispatchOwnerVerifiedBookedVisit(
 workspaceSlug:string,quoteId:string,visitId:string,deps:OwnerDispatchDeps={},
):Promise<OwnerDispatchResult>{
 if(!(deps.enabled??(()=>process.env.SERVICEDESK_F26_OWNER_DISPATCH_ENABLED==="true"))())
  return fail("NOT_ACTIVATED");
 if(!slug(workspaceSlug)||!uuid(quoteId)||!uuid(visitId)||quoteId===visitId)
  return fail("INVALID_SELECTION");
 if((deps.mode??operationalDatabaseMode)()!=="SERVICE_ROLE")
  return fail("OWNER_REQUIRED");
 const resolve=deps.resolve??resolveStaffActor;
 const load=deps.loadBooking??loadOwnerSavedBookingReceipt;
 try{
  const first=await resolve(workspaceSlug);
  if(!authorized(first,workspaceSlug))return fail("OWNER_REQUIRED");
  const before=await load(workspaceSlug,quoteId);
  if(!before.ok||before.value.state!=="SAVED_BOOKING_WITH_APPLIED_DEPOSIT"||
    before.value.quoteId!==quoteId||before.value.visitId!==visitId||
    before.value.recordedDepositApplication!==true||
    before.value.bookingRecordPresent!==true)return fail("BOOKING_UNVERIFIED");
  if(before.value.visitStatus!=="SCHEDULED")return fail("VISIT_NOT_SCHEDULED");
  const second=await resolve(workspaceSlug);
  if(!authorized(second,workspaceSlug)||
     first.value.workspace.id!==second.value.workspace.id||
     first.value.actor.userId!==second.value.actor.userId)
   return fail("SOURCE_CHANGED");
  // A second source read prevents a different saved booking state being
  // selected between the owner click and the privileged visit transition.
  const checked=await load(workspaceSlug,quoteId);
  if(!checked.ok||checked.value.visitStatus!=="SCHEDULED"||
     checked.value.visitId!==visitId||
     checked.value.invoiceId!==before.value.invoiceId||
     checked.value.quoteVersion!==before.value.quoteVersion||
     checked.value.startsAt!==before.value.startsAt)
   return fail("SOURCE_CHANGED");
  const action=await (deps.transition??transitionOperationalVisit)(
   workspaceSlug,visitId,"ASSIGN");
  if(!action.ok)return fail("DISPATCH_REJECTED");
  // Post-write: reauthorize same owner and require full, fresh F25
  // payment+visit+hold+invoice proof, now with ASSIGNED persisted.
  const third=await resolve(workspaceSlug);
  if(!authorized(third,workspaceSlug)||
     third.value.workspace.id!==first.value.workspace.id||
     third.value.actor.userId!==first.value.actor.userId)
   return fail("POST_WRITE_UNVERIFIED");
  const after=await load(workspaceSlug,quoteId);
  if(!after.ok||after.value.state!=="SAVED_BOOKING_WITH_APPLIED_DEPOSIT"||
     after.value.visitId!==visitId||after.value.quoteId!==quoteId||
     after.value.visitStatus!=="ASSIGNED"||
     after.value.invoiceId!==before.value.invoiceId||
     after.value.quoteVersion!==before.value.quoteVersion||
     after.value.startsAt!==before.value.startsAt||
     after.value.recordedDepositApplication!==true||
     after.value.bookingRecordPresent!==true)
   return fail("POST_WRITE_UNVERIFIED");
  return {ok:true,state:"SAVED_VISIT_ASSIGNED_VERIFIED",quoteId,visitId,
   invoiceId:after.value.invoiceId,visitStatus:"ASSIGNED",
   providerDeliveryVerified:false,customerMessaged:false,
   paymentProcessed:false,newBookingCreated:false,calendarOutboxMayBeQueued:true};
 }catch{return fail("POST_WRITE_UNVERIFIED");}
}
