"use client";
import {useEffect,useRef,useState} from "react";
import Link from "next/link";
import {createInboxFirstQuote,type InboxFirstQuoteActionResult} from "./inbox-first-quote-action";

export function InboxFirstQuoteAction({workspaceSlug,conversationId}:{
 workspaceSlug:string;conversationId:string;
}){
 return <ScopedFirstQuote key={workspaceSlug+":"+conversationId}
  slug={workspaceSlug} conversationId={conversationId}/>;
}
function ScopedFirstQuote({slug,conversationId}:{slug:string;conversationId:string}){
 const [receipt,setReceipt]=useState<Extract<InboxFirstQuoteActionResult,{ok:true}>>();
 const [error,setError]=useState(false),[busy,setBusy]=useState(false);
 const pending=useRef(false),mounted=useRef(true),serial=useRef(0);
 useEffect(()=>{const m=mounted,s=serial;m.current=true;return()=>{m.current=false;s.current++;};},[]);
 async function submit(){
  if(pending.current||receipt)return;
  pending.current=true;setBusy(true);setError(false);
  const seq=++serial.current;
  try{
   const res=await createInboxFirstQuote(slug,conversationId);
   if(!mounted.current||serial.current!==seq)return;
   if(!res.ok||res.state!=="FIRST_QUOTE_SAVED"||
      res.manualApprovalRequired!==true||res.customerMessageSent!==false||
      res.providerInvoked!==false||res.bookingCreated!==false||res.paymentChanged!==false){
    setError(true);return;
   }
   setReceipt(res);
  }catch{if(mounted.current&&seq===serial.current)setError(true);}
  finally{pending.current=false;if(mounted.current&&seq===serial.current)setBusy(false);}
 }
 return <section aria-label="Inbox saved first cleaning quote" data-testid="f21-inbox-first-quote"
   style={{border:"1px solid #d5e3dd",borderRadius:12,padding:16,marginBlock:14}}>
  <h3>Calculate initial cleaning quote</h3>
  <p>The request's saved service and room counts must be complete, and its branch must have
   real approved prices. This creates only an initial DRAFT/PENDING_APPROVAL quote using the
   existing pricing engine. No extra oven charge is included and no customer is contacted.</p>
  <button type="button" disabled={busy||Boolean(receipt)} aria-busy={busy}
    onClick={()=>void submit()}>
   {busy?"Verifying the saved first quote…":
    receipt?"Initial quote verified":"Calculate saved first quote"}
  </button>
  {error?<p role="alert">The quote could not be verified. Reload Requests/Quotes before trying again:
   a quote may already have been saved. Never retry automatically.</p>:null}
  {receipt?<div role="status" aria-live="polite">
   <strong>Initial quote saved and independently verified</strong>
   <p>Saved revision {receipt.quoteVersion}. Human price review and approval are required.
    No quote was sent, booking created or payment recorded.</p>
   <Link href={"/app/"+encodeURIComponent(slug)+"/quotes?quote="+encodeURIComponent(receipt.quoteId)}>
    Open saved quote for staff review</Link>
  </div>:null}
 </section>;
}
