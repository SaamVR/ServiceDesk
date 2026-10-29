"use client";
import {useEffect,useRef,useState} from "react";
import {requestF15OwnerLeadEscalation} from "./f15-owner-lead-sla-action";
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
 const [busy,setBusy]=useState(false),mounted=useRef(true),pending=useRef(false),seq=useRef(0);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;seq.current++;};},[]);
 async function review(){
  if(pending.current)return;
  pending.current=true;setBusy(true);setState(null);
  const call=++seq.current;
  try{
   const v=await requestF15OwnerLeadEscalation(slug,branchId,requestId);
   if(mounted.current&&call===seq.current)setState(v.state);
  }catch{if(mounted.current&&call===seq.current)setState("UNAVAILABLE");}
  finally{pending.current=false;if(mounted.current&&call===seq.current)setBusy(false);}
 }
 const copy:Record<State,string>={
  NOT_ACTIVATED:"Protected SLA journal is not activated. The reviewed SQL source is not installed or authorized; no escalation was recorded.",
  UNAVAILABLE:"A complete authorized response history, current revision, or committed database receipt could not be verified. No escalation is claimed.",
  NOT_DUE:"No saved overdue unanswered lead was proven at the time of review.",
  OWNER_REVIEW_RECORDED:"A scoped internal owner-review event was committed and verified. It was not executed as a workflow or sent to a customer.",
  ALREADY_RECORDED:"The existing scoped internal-review event was verified again; the same inbound message did not create a duplicate.",
 };
 return <section className="app-panel" aria-label="Protected unanswered lead escalation"
   data-testid="f15-protected-owner-escalation">
  <h3>Overdue customer message · protected internal review</h3>
  <p>Only a verified owner can review this request. The server rechecks the complete saved reply history and requires an atomic database receipt. This cannot send messages or run rules.</p>
  <button type="button" onClick={()=>void review()} disabled={busy} aria-busy={busy}>
   {busy?"Rechecking saved lead and response history…":"Check overdue lead and record internal review"}
  </button>
  {state?<p role="status" aria-live="polite">{copy[state]}</p>:null}
 </section>;
}
