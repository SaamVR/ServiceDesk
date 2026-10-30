"use client";
import {useEffect,useRef,useState} from "react";
import {requestF15InboxSlaReview,type F15InboxSlaUIResult} from "./f15-inbox-sla-review-action";

export function AiUnansweredLeadSlaReview({workspaceSlug,conversationId}:{
 workspaceSlug:string;conversationId:string;
}){
 return <ScopedLeadReview key={workspaceSlug+":"+conversationId}
  workspaceSlug={workspaceSlug} conversationId={conversationId}/>;
}
function ScopedLeadReview({workspaceSlug,conversationId}:{
 workspaceSlug:string;conversationId:string;
}){
 const [threshold,setThreshold]=useState(60);
 const [result,setResult]=useState<Extract<F15InboxSlaUIResult,{ok:true}>>();
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(false);
 const mounted=useRef(true),serial=useRef(0),pending=useRef(false);
 useEffect(()=>{const m=mounted,s=serial;m.current=true;return()=>{m.current=false;s.current++;};},[]);
 async function check(){
  if(pending.current)return;
  pending.current=true;setBusy(true);setError("");setResult(undefined);
  const seq=++serial.current;
  try{
   const r=await requestF15InboxSlaReview(workspaceSlug,conversationId,threshold);
   if(!mounted.current||serial.current!==seq)return;
   if(!r.ok||!["SAVED_SLA_OVERDUE","SAVED_SLA_NOT_DUE"].includes(r.state)||
     r.staffReviewRequired!==true||r.eventRecorded!==false||
     r.messageSent!==false||r.providerInvoked!==false||
     r.modelInvoked!==false||r.moneyChanged!==false||
     r.thresholdMinutes!==threshold){
    setError("Saved lead, staff-response or owner authorization evidence is unavailable or changed.");return;
   }
   setResult(r);
  }catch{
   if(mounted.current&&serial.current===seq)
    setError("Saved lead SLA check unavailable. No escalation was recorded.");
  }finally{
   pending.current=false;
   if(mounted.current&&serial.current===seq)setBusy(false);
  }
 }
 return <section aria-label="Saved unanswered-lead SLA check" data-testid="f15-saved-inbox-sla"
   style={{border:"1px solid #d3dedb",borderRadius:12,padding:16,marginBlock:14}}>
  <h3>Unanswered lead · owner SLA review</h3>
  <p>Recheck the selected saved request and complete message history before deciding whether manual follow-up is needed.</p>
  <label htmlFor="f15-sla-threshold">Follow-up review threshold</label>{" "}
  <select id="f15-sla-threshold" value={threshold} disabled={busy}
   onChange={e=>{setThreshold(Number(e.target.value));setResult(undefined);setError("");}}>
   <option value={30}>30 minutes</option>
   <option value={60}>60 minutes</option>
   <option value={120}>120 minutes</option>
  </select>{" "}
  <button type="button" onClick={()=>void check()} disabled={busy} aria-busy={busy}>
   {busy?"Rechecking saved messages…":"Check saved lead SLA"}
  </button>
  {error?<p role="alert">{error}</p>:null}
  {result?<div role="status" aria-live="polite">
   <strong>{result.state==="SAVED_SLA_OVERDUE"?
     "Overdue · manual owner review required":"No overdue unanswered-lead escalation due"}</strong>
   <p>Channel: {result.channel} · saved request revision {result.requestVersion} · threshold {result.thresholdMinutes} minutes</p>
   <p>Review threshold: {result.dueAt}</p>
   <p>This is an on-demand read-only assessment. No durable SLA event, workflow, provider message or payment has been created. Review the saved thread before responding.</p>
  </div>:null}
 </section>;
}
