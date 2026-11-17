"use server";
import {releaseOwnerVerifiedQuoteHold} from "@/server/workflows/owner-verified-quote-hold-release";

export type VerifiedHoldReleaseAction=
 | {ok:false;state:"HOLD_RELEASE_UNAVAILABLE"}
 | {ok:true;state:"HOLD_RELEASED_VERIFIED";bookingCreated:false;
   paymentChanged:false;customerNotified:false;newCapacityUnverified:true};
const unavailable=():VerifiedHoldReleaseAction=>({ok:false,state:"HOLD_RELEASE_UNAVAILABLE"});
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export async function releaseVerifiedOwnerQuoteHold(
 workspaceSlug:string,quoteId:string,holdId:string,
):Promise<VerifiedHoldReleaseAction>{
 if(typeof workspaceSlug!=="string"||workspaceSlug.length<3||workspaceSlug.length>40||
   !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(workspaceSlug)||
   !uuid.test(quoteId)||!uuid.test(holdId)||quoteId===holdId)return unavailable();
 try{
  const result=await releaseOwnerVerifiedQuoteHold(workspaceSlug,quoteId,holdId);
  if(!result.ok||result.state!=="SAVED_HOLD_RELEASE_VERIFIED"||
     result.holdId!==holdId||result.quoteId!==quoteId||
     result.bookingCreated!==false||result.paymentChanged!==false||
     result.customerNotified!==false||result.newCapacityUnverified!==true)
   return unavailable();
  return {ok:true,state:"HOLD_RELEASED_VERIFIED",bookingCreated:false,
   paymentChanged:false,customerNotified:false,newCapacityUnverified:true};
 }catch{return unavailable();}
}
