"use client";
import { useEffect, useRef, useState } from "react";
import { requestF15SavedIntakeReview, type F15IntakeReview } from "./f15-saved-intake-review-action";

export function AiSavedIntakeReview({workspaceSlug,requestId}:{workspaceSlug:string;requestId:string}){
 const scope=workspaceSlug+":"+requestId;
 return <ScopedIntake key={scope} workspaceSlug={workspaceSlug} requestId={requestId}/>;
}
function ScopedIntake({workspaceSlug,requestId}:{workspaceSlug:string;requestId:string}){
 const [result,setResult]=useState<Extract<F15IntakeReview,{ok:true}>>();
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(false);
 const current=useRef(true),pending=useRef(false),sequence=useRef(0);
 useEffect(()=>{current.current=true;return()=>{current.current=false;sequence.current++;};},[]);
 async function review(){
  if(pending.current)return;
  pending.current=true;setBusy(true);setResult(undefined);setError("");
  const seq=++sequence.current;
  try{
   const r=await requestF15SavedIntakeReview(workspaceSlug,requestId);
   if(!current.current||seq!==sequence.current)return;
   if(!r.ok||r.state!=="SAVED_INTAKE_REVIEW_ONLY"||
      r.staffConfirmationRequired!==true||r.customerContactSent!==false||
      r.modelInvoked!==false||r.bookingChanged!==false||r.pricingChanged!==false){
    setError("Saved request access, status or version could not be verified. Reopen the source request.");return;
   }
   setResult(r);
  }catch{if(current.current&&seq===sequence.current)setError("The saved intake review is unavailable; no action was taken.");}
  finally{pending.current=false;if(current.current&&seq===sequence.current)setBusy(false);}
 }
 return <section aria-label="Saved request clarification review" data-testid="f15-saved-intake-review">
  <h4>Saved request clarification · no AI subscription</h4>
  <p>Recheck this persisted enquiry and prepare questions for staff review. Nothing is sent or saved.</p>
  <button type="button" onClick={()=>void review()} disabled={busy} aria-busy={busy}>
   {busy?"Rechecking saved request…":"Review saved intake"}
  </button>
  {error?<p role="alert">{error}</p>:null}
  {result?<div role="status" aria-live="polite">
   <strong>{result.classification.replaceAll("_"," ").toLowerCase()}</strong>
   <p>Saved revision {result.sourceVersion}. Staff confirmation is required.</p>
   {result.questions.length?<ul>{result.questions.map(q=><li key={q.field}>{q.text}</li>)}</ul>
    :<p>No missing intake fields were identified in the supported saved fields; verify the full request before progressing.</p>}
   <p>Review-only; no quote, booking, customer message or AI provider call occurred.</p>
  </div>:null}
 </section>;
}
