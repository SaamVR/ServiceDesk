"use client";
import Link from "next/link";
import {useEffect,useRef,useState} from "react";
import {dispatchVerifiedOwnerBookedVisit} from "./owner-verified-dispatch-action";
export function OwnerVerifiedBookingDispatchControls({
 workspaceSlug,quoteId,visitId,
}:{workspaceSlug:string;quoteId:string;visitId:string}){
 return <SelectedBookingDispatch key={workspaceSlug+":"+quoteId+":"+visitId}
   slug={workspaceSlug} quoteId={quoteId} visitId={visitId}/>;
}
function SelectedBookingDispatch({slug,quoteId,visitId}:{
 slug:string;quoteId:string;visitId:string;
}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(false),
   [assigned,setAssigned]=useState(false);
 const attempted=useRef(false),mounted=useRef(true),seq=useRef(0);
 useEffect(()=>{const m=mounted,s=seq;m.current=true;return()=>{m.current=false;s.current++;};},[]);
 async function dispatch(){
  if(attempted.current)return;
  attempted.current=true;setBusy(true);setError(false);
  const current=++seq.current;
  try{
   const r=await dispatchVerifiedOwnerBookedVisit(slug,quoteId,visitId);
   if(!mounted.current||current!==seq.current)return;
   if(!r.ok||r.state!=="SAVED_VISIT_ASSIGNED_VERIFIED"||
      r.providerDeliveryVerified!==false||r.paymentProcessed!==false||
      r.customerMessaged!==false||r.newBookingCreated!==false||
      r.calendarOutboxMayBeQueued!==true){setError(true);return;}
   setAssigned(true);
  }catch{if(mounted.current&&current===seq.current)setError(true);}
  finally{if(mounted.current&&current===seq.current)setBusy(false);}
 }
 return <div data-testid="f26-booked-visit-dispatch" aria-label="Owner booked visit dispatch">
  <p>This saved visit has an applied deposit and a confirmed slot.
   Assign it for dispatch only after reviewing the crew in Schedule.
   The assignment can queue a calendar update, not proof of calendar delivery.</p>
  {!assigned&&!error?<button type="button" disabled={busy} aria-busy={busy}
   onClick={()=>void dispatch()}>
   {busy?"Verifying paid booking and assigning visit…":"Assign this verified booked visit"}
  </button>:null}
  {error?<p role="alert">Dispatch was not independently verified.
    A visit transition may already have occurred. Refresh Schedule before any
    further action; no automatic retry was attempted.</p>:null}
  {assigned?<p role="status">Saved visit status ASSIGNED was independently verified.
    No new booking, payment or customer message was created by this action.
    Calendar delivery remains unverified.{" "}
    <Link href={"/app/"+encodeURIComponent(slug)+"/schedule"}>Open Schedule</Link>
  </p>:null}
 </div>;
}
