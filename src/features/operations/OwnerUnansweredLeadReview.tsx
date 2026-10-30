"use client";
import {useEffect,useRef,useState} from "react";
import {requestF15OwnerLeadEscalation,requestF15OwnerReviewEvidence} from "./f15-owner-lead-sla-action";
import type {F15ReviewEvidence} from "@/server/workflows/sonic-f15-owner-review-evidence";
type State="NOT_ACTIVATED"|"UNAVAILABLE"|"NOT_DUE"|"OWNER_REVIEW_RECORDED"|"ALREADY_RECORDED";
export function OwnerUnansweredLeadReview({workspaceSlug,requestId,branchId}:{
 workspaceSlug:string;requestId:string;branchId:string;
}){
 return <ScopedLead key={workspaceSlug+":"+branchId+":"+requestId}
  slug={workspaceSlug} branchId={branchId} requestId={requestId}/>;
}
function ScopedLead({slug,requestId,branchId}:{
 slug:string;requestId:string;branchId:string;
}){
 const [state,setState]=useState<State|null>(null);
 const [evidence,setEvidence]=useState<F15ReviewEvidence|null>(null);
 const [busy,setBusy]=useState(false),mounted=useRef(true),pending=useRef(false),seq=useRef(0);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;seq.current++;};},[]);
 async function review(){
  if(pending.current)return;
  pending.current=true;setBusy(true);setState(null);setEvidence(null);
  const call=++seq.current;
  try{
   const v=await requestF15OwnerLeadEscalation(slug,branchId,requestId);
   if(!mounted.current||call!==seq.current)return;
   setState(v.state);
   if(v.state==="OWNER_REVIEW_RECORDED"||v.state==="ALREADY_RECORDED"){
    const proof=await requestF15OwnerReviewEvidence(slug,branchId,requestId);
    if(mounted.current&&call===seq.current)setEvidence(proof);
   }
  }catch{if(mounted.current&&call===seq.current)setState("UNAVAILABLE");}
  finally{pending.current=false;if(mounted.current&&call===seq.current)setBusy(false);}
 }
 async function refreshEvidence(){
  if(pending.current)return;
  pending.current=true;setBusy(true);setEvidence(null);
  const call=++seq.current;
  try{
   const proof=await requestF15OwnerReviewEvidence(slug,branchId,requestId);
   if(mounted.current&&call===seq.current)setEvidence(proof);
  }catch{if(mounted.current&&call===seq.current)setEvidence({state:"UNAVAILABLE"});}
  finally{pending.current=false;if(mounted.current&&call===seq.current)setBusy(false);}
 }
 const copy:Record<State,string>={
  NOT_ACTIVATED:"Protected SLA claim is disabled. No new escalation was attempted; saved historical evidence can still be read separately.",
  UNAVAILABLE:"A complete authorized response history, current revision, or committed database receipt could not be verified. No escalation is claimed.",
  NOT_DUE:"No saved overdue unanswered lead was proven at the time of review.",
  OWNER_REVIEW_RECORDED:"The protected database claim reported a committed event. See independent saved readback below before treating it as persisted proof. No workflow or customer message executed.",
  ALREADY_RECORDED:"The protected database claim reported an idempotent replay. Check saved readback below; no new customer message was sent.",
 };
 return <section className="app-panel" aria-label="Protected unanswered lead escalation"
   data-testid="f15-protected-owner-escalation">
  <h3>Overdue customer message · protected internal review</h3>
  <p>Only a verified owner can review this request. The server rechecks the complete saved reply history and requires an atomic database receipt. This cannot send messages or run rules.</p>
  <button type="button" onClick={()=>void review()} disabled={busy} aria-busy={busy}>
   {busy?"Rechecking saved lead and response history…":"Check overdue lead and record internal review"}
  </button>
  {state?<p role="status" aria-live="polite">{copy[state]}</p>:null}
  <button type="button" onClick={()=>void refreshEvidence()} disabled={busy} aria-busy={busy}>
   {busy?"Reading saved review evidence…":"Read saved owner-review journal"}
  </button>
  {evidence?.state==="SAVED_OWNER_REVIEW_CONFIRMED"?
   <p role="status">Persisted internal review readback verified: {evidence.count} recorded review event(s);
    latest saved at {evidence.latestAt}. Still requires human approval. No workflow execution or customer message.</p>:
   evidence?.state==="NO_REVIEW_RECORDED"?
    <p role="status">No saved internal review exists for this selected request.</p>:
   evidence?.state==="UNAVAILABLE"?
    <p role="alert">Saved journal readback is unavailable or inconsistent; do not treat the claim as an operational success.</p>:null}
 </section>;
}
