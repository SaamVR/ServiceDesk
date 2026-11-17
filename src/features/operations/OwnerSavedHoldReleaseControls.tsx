"use client";
import Link from "next/link";
import {useEffect,useRef,useState} from "react";
import {releaseVerifiedOwnerQuoteHold} from "./verified-hold-release-action";

export function OwnerSavedHoldReleaseControls({workspaceSlug,quoteId,holdId,expiresAt}:{
 workspaceSlug:string;quoteId:string;holdId:string;expiresAt:string;
}){
 return <SelectedHold key={workspaceSlug+":"+quoteId+":"+holdId}
  slug={workspaceSlug} quoteId={quoteId} holdId={holdId} expiresAt={expiresAt}/>;
}
function SelectedHold({slug,quoteId,holdId,expiresAt}:{
 slug:string;quoteId:string;holdId:string;expiresAt:string;
}){
 const [done,setDone]=useState(false),[error,setError]=useState(false);
 const [busy,setBusy]=useState(false),locked=useRef(false),mounted=useRef(true),serial=useRef(0);
 useEffect(()=>{const m=mounted,s=serial;m.current=true;return()=>{m.current=false;s.current++;};},[]);
 async function release(){
  if(locked.current)return;
  locked.current=true;setBusy(true);setError(false);
  const n=++serial.current;
  try{
   const x=await releaseVerifiedOwnerQuoteHold(slug,quoteId,holdId);
   if(!mounted.current||serial.current!==n)return;
   if(!x.ok||x.state!=="HOLD_RELEASED_VERIFIED"||x.bookingCreated!==false||
     x.paymentChanged!==false||x.customerNotified!==false||
     x.newCapacityUnverified!==true){setError(true);return;}
   setDone(true);
  }catch{if(mounted.current&&serial.current===n)setError(true);}
  finally{if(mounted.current&&serial.current===n)setBusy(false);}
 }
 return <div data-testid="f23-owner-hold-release" aria-label="Release unused saved capacity hold">
  <p>Saved temporary hold until {new Date(expiresAt).toUTCString()}. Releasing it
    does not confirm or cancel a booking, refund a payment, or notify a customer.</p>
  {!done&&!error?<button type="button" disabled={busy} aria-busy={busy}
     onClick={()=>void release()}>
    {busy?"Checking saved hold and owner authority…":"Release this unused hold"}
  </button>:null}
  {error?<p role="alert">Release result could not be independently verified.
    The hold may already have been released. Refresh Schedule or Quotes
    before any further action; no automatic retry was attempted.</p>:null}
  {done?<div role="status" aria-live="polite">
    <strong>Saved hold release independently verified.</strong>
    <p>No booking or payment state changed. Capacity should be rechecked before
      offering another customer a slot.</p>
    <Link href={"/app/"+encodeURIComponent(slug)+"/schedule"}>Open Schedule</Link>
  </div>:null}
 </div>;
}
