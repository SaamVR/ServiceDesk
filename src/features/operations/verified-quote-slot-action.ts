"use server";
import {holdOwnerVerifiedQuoteSlot} from "@/server/workflows/owner-verified-quote-slot-hold";
export type QuoteSlotHoldActionResult=
 | {ok:false;state:"SLOT_HOLD_UNAVAILABLE"}
 | {ok:true;state:"SLOT_HELD_VERIFIED";holdId:string;slotId:string;quoteId:string;expiresAt:string;
    bookingConfirmed:false;paymentCaptured:false;customerNotified:false;manualFollowUpRequired:true};
const failed=():QuoteSlotHoldActionResult=>({ok:false,state:"SLOT_HOLD_UNAVAILABLE"});
/** Only UUID selectors cross from UI. Staff identity and source are server reads. */
export async function holdVerifiedOwnerQuoteSlot(workspaceSlug:string,quoteId:string,slotId:string):
 Promise<QuoteSlotHoldActionResult>{
 if(typeof workspaceSlug!=="string"||workspaceSlug.length<3||workspaceSlug.length>40||
   !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(workspaceSlug)||
   [quoteId,slotId].some(v=>typeof v!=="string"||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v))||
   quoteId===slotId)return failed();
 try{
  const r=await holdOwnerVerifiedQuoteSlot(workspaceSlug,quoteId,slotId);
  if(!r.ok||r.state!=="SAVED_SLOT_HOLD_VERIFIED"||r.quoteId!==quoteId||
    r.slotId!==slotId||r.bookingConfirmed!==false||r.paymentCaptured!==false||
    r.customerNotified!==false||r.manualFollowUpRequired!==true||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(r.holdId)||
    typeof r.expiresAt!=="string"||!Number.isFinite(Date.parse(r.expiresAt))||
    Date.parse(r.expiresAt)<=Date.now())return failed();
  return {ok:true,state:"SLOT_HELD_VERIFIED",holdId:r.holdId,
   quoteId,slotId,expiresAt:r.expiresAt,
   bookingConfirmed:false,paymentCaptured:false,customerNotified:false,
   manualFollowUpRequired:true};
 }catch{return failed();}
}
