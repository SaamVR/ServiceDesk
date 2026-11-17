"use server";
import {dispatchOwnerVerifiedBookedVisit} from "@/server/workflows/owner-verified-booking-dispatch";
export type OwnerDispatchActionReceipt=
 | {ok:false;state:"OWNER_DISPATCH_UNAVAILABLE"}
 | {ok:true;state:"SAVED_VISIT_ASSIGNED_VERIFIED";
    providerDeliveryVerified:false;customerMessaged:false;paymentProcessed:false;
    newBookingCreated:false;calendarOutboxMayBeQueued:true};
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const denied=():OwnerDispatchActionReceipt=>({ok:false,state:"OWNER_DISPATCH_UNAVAILABLE"});
/** The source visit is a server-verified APPLIED deposit booking, not a hold. */
export async function dispatchVerifiedOwnerBookedVisit(
 workspaceSlug:string,quoteId:string,visitId:string,
):Promise<OwnerDispatchActionReceipt>{
 if(typeof workspaceSlug!=="string"||workspaceSlug.length<3||workspaceSlug.length>40||
   !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(workspaceSlug)||
   !uuid.test(quoteId)||!uuid.test(visitId)||quoteId===visitId)return denied();
 try{
  const v=await dispatchOwnerVerifiedBookedVisit(workspaceSlug,quoteId,visitId);
  if(!v.ok||v.state!=="SAVED_VISIT_ASSIGNED_VERIFIED"||
     v.quoteId!==quoteId||v.visitId!==visitId||v.visitStatus!=="ASSIGNED"||
     v.providerDeliveryVerified!==false||v.customerMessaged!==false||
     v.paymentProcessed!==false||v.newBookingCreated!==false||
     v.calendarOutboxMayBeQueued!==true)return denied();
  return {ok:true,state:"SAVED_VISIT_ASSIGNED_VERIFIED",
    providerDeliveryVerified:false,customerMessaged:false,paymentProcessed:false,
    newBookingCreated:false,calendarOutboxMayBeQueued:true};
 }catch{return denied();}
}
