"use client";
import { useEffect, useRef, useState } from "react";
import { requestF15SavedCapacityReview, type F15DispatchReview } from "./f15-saved-capacity-review-action";
import Link from "next/link";
import { buildStaffModuleHref } from "./staff-modules";
export function AiSavedCapacityReview({workspaceSlug}:{workspaceSlug:string}){
 return <ScopedCapacity key={workspaceSlug} workspaceSlug={workspaceSlug}/>;
}
function ScopedCapacity({workspaceSlug}:{workspaceSlug:string}){
 const [value,setValue]=useState<Extract<F15DispatchReview,{ok:true}>>();
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 const pending=useRef(false),active=useRef(true),serial=useRef(0);
 useEffect(()=>{active.current=true;return()=>{active.current=false;serial.current++;};},[]);
 async function review(){
  if(pending.current)return;
  pending.current=true;setBusy(true);setValue(undefined);setError("");
  const seq=++serial.current;
  try{
   const r=await requestF15SavedCapacityReview(workspaceSlug);
   if(!active.current||seq!==serial.current)return;
   if(!r.ok||r.state!=="SAVED_CAPACITY_REVIEW_ONLY"||r.assigned!==false||
      r.messagesSent!==false||r.modelInvoked!==false||
      r.skillsUnverified!==true||r.staffApprovalRequired!==true){
    setError("Current saved crew availability could not be verified. Review dispatch records directly.");return;
   }
   setValue(r);
  }catch{if(active.current&&seq===serial.current)setError("Capacity review is unavailable; no crew assignment was attempted.");}
  finally{pending.current=false;if(active.current&&seq===serial.current)setBusy(false);}
 }
 return <section aria-label="Saved crew capacity advisory" data-testid="f15-saved-capacity">
  <h3>Crew availability · saved records</h3>
  <p>Review unassigned confirmed visits and saved capacity/hold conflicts. Crew skills and final slot availability need manual verification.</p>
  <button type="button" onClick={()=>void review()} disabled={busy} aria-busy={busy}>
   {busy?"Rechecking crew capacity…":"Review saved dispatch capacity"}
  </button>
  {error?<p role="alert">{error}</p>:null}
  {value?<div role="status" aria-live="polite">
    <p>{value.visitsNeedingAssignment} unassigned confirmed visits · {value.availableSlotCandidates} possible slot matches · {value.blockedVisits} without an eligible saved slot.</p>
    {value.reasons.length?<p>Review flags: {value.reasons.map(x=>x.replaceAll("_"," ").toLowerCase()).join(", ")}.</p>:null}
    <p>Potential matches do not certify crew skills, booking, assignment or confirmed capacity. Revalidate at the dispatch command.</p>
    <Link href={buildStaffModuleHref(workspaceSlug,"schedule")}>Open authoritative schedule</Link>
  </div>:null}
 </section>;
}
