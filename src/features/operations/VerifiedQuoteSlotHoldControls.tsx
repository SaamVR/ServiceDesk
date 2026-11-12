"use client";
import {useEffect,useRef,useState} from "react";
import Link from "next/link";
import {holdVerifiedOwnerQuoteSlot,type QuoteSlotHoldActionResult} from "./verified-quote-slot-action";

export interface QuoteHoldCandidate{slotId:string;startAt:string;endAt:string}
export function VerifiedQuoteSlotHoldControls({workspaceSlug,quoteId,candidates}:{
 workspaceSlug:string;quoteId:string;candidates:readonly QuoteHoldCandidate[];
}){
 return <SelectedQuoteHolds key={workspaceSlug+":"+quoteId} slug={workspaceSlug} quoteId={quoteId}
    candidates={candidates}/>;
}
function SelectedQuoteHolds({slug,quoteId,candidates}:{
 slug:string;quoteId:string;candidates:readonly QuoteHoldCandidate[];
}){
 const [result,setResult]=useState<Extract<QuoteSlotHoldActionResult,{ok:true}>>();
 const [error,setError]=useState(false),[busy,setBusy]=useState(false);
 const done=useRef(false),mounted=useRef(true),serial=useRef(0);
 useEffect(()=>{const m=mounted,s=serial;m.current=true;return()=>{m.current=false;s.current++;};},[]);
 async function hold(slotId:string){
  if(done.current)return;
  done.current=true;setBusy(true);setError(false);
  const seq=++serial.current;
  try{
   const r=await holdVerifiedOwnerQuoteSlot(slug,quoteId,slotId);
   if(!mounted.current||seq!==serial.current)return;
   if(!r.ok||r.state!=="SLOT_HELD_VERIFIED"||r.quoteId!==quoteId||r.slotId!==slotId||
      r.bookingConfirmed!==false||r.paymentCaptured!==false||
      r.customerNotified!==false||r.manualFollowUpRequired!==true){
    setError(true);return;
   }
   setResult(r);
  }catch{if(mounted.current&&seq===serial.current)setError(true);}
  finally{if(mounted.current&&seq===serial.current)setBusy(false);}
 }
 return <div aria-label="Verified quote slot hold controls" data-testid="f22-verified-quote-slot">
  <p>Times below are saved capacity candidates, not guaranteed availability.
   Only a click can request a temporary hold. A hold is not a booking or payment.</p>
  {candidates.length? <ul>{candidates.map(c=><li key={c.slotId}>
   <span>{new Date(c.startAt).toUTCString()} – {new Date(c.endAt).toUTCString()}</span>{" "}
   <button type="button" disabled={busy||error||Boolean(result)} aria-busy={busy}
     onClick={()=>void hold(c.slotId)}>
    {busy?"Checking saved hold…":"Hold this slot"}
   </button>
  </li>)}</ul>:
   <p role="status">No candidate slots in the saved schedule. Create real crew capacity or refresh Schedule.</p>}
  {error?<p role="alert">Hold result could not be verified. A hold may already exist.
   Refresh Schedule before taking another action; no automatic retry was attempted.</p>:null}
  {result?<div role="status" aria-live="polite">
   <strong>Temporary slot hold saved and independently verified</strong>
   <p>Hold expires at {new Date(result.expiresAt).toUTCString()}.
    No visit/booking confirmation, customer notification, or payment has occurred.</p>
   <Link href={"/app/"+encodeURIComponent(slug)+"/schedule"}>Continue in Schedule</Link>
  </div>:null}
 </div>;
}
