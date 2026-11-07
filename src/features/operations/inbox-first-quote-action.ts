"use server";
import {calculateOwnerInboxFirstQuote} from "@/server/ai/owner-inbox-first-quote";
export type InboxFirstQuoteActionResult=
 | {ok:false;state:"FIRST_QUOTE_UNAVAILABLE"}
 | {ok:true;state:"FIRST_QUOTE_SAVED";quoteId:string;quoteVersion:number;
   manualApprovalRequired:true;customerMessageSent:false;providerInvoked:false;
   bookingCreated:false;paymentChanged:false};
const denied=():InboxFirstQuoteActionResult=>({ok:false,state:"FIRST_QUOTE_UNAVAILABLE"});
/** The browser passes only a saved conversation selector, never pricing. */
export async function createInboxFirstQuote(workspaceSlug:string,conversationId:string):
 Promise<InboxFirstQuoteActionResult>{
 if(typeof workspaceSlug!=="string"||workspaceSlug.length<3||workspaceSlug.length>40||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(workspaceSlug)||
    typeof conversationId!=="string"||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(conversationId))
   return denied();
 try{
  const result=await calculateOwnerInboxFirstQuote(workspaceSlug,conversationId);
  if(!result.ok)return denied();
  if(result.state!=="FIRST_QUOTE_SAVED_VERIFIED"||
     !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(result.quoteId)||
     !Number.isSafeInteger(result.quoteVersion)||result.quoteVersion<1||
     result.preexistingQuotes!==0||result.manualApprovalRequired!==true||
     result.customerMessageSent!==false||result.providerInvoked!==false||
     result.bookingCreated!==false||result.paymentChanged!==false)return denied();
  return {ok:true,state:"FIRST_QUOTE_SAVED",quoteId:result.quoteId,
   quoteVersion:result.quoteVersion,manualApprovalRequired:true,
   customerMessageSent:false,providerInvoked:false,bookingCreated:false,paymentChanged:false};
 }catch{return denied();}
}
