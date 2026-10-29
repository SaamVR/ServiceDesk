"use client";
import Link from "next/link";
import {useEffect,useRef,useState} from "react";
import {requestF20RetentionReview,type F20RetentionReply} from "./f20-owner-retention-review-action";
import {buildStaffModuleHref} from "./staff-modules";
export function OwnerConsentedRetentionReview({workspaceSlug}:{workspaceSlug:string}){
 return <ScopedRetention key={workspaceSlug} slug={workspaceSlug}/>;
}
function ScopedRetention({slug}:{slug:string}){
 const [result,setResult]=useState<Extract<F20RetentionReply,{ok:true}>>();
 const [error,setError]=useState(""),[busy,setBusy]=useState(false);
 const active=useRef(true),pending=useRef(false),seq=useRef(0);
 useEffect(()=>{active.current=true;return()=>{active.current=false;seq.current++;};},[]);
 async function review(){
  if(pending.current)return;
  pending.current=true;setBusy(true);setResult(undefined);setError("");
  const sequence=++seq.current;
  try{
   const x=await requestF20RetentionReview(slug);
   if(!active.current||seq.current!==sequence)return;
   if(!x.ok||x.state!=="OWNER_CONSENTED_RETENTION_REVIEW"||
      x.historicalCompletenessVerified!==false||x.churnProven!==false||
      x.staffApprovalRequired!==true||x.sendConsentMustBeRechecked!==true||
      x.messagesSent!==false||x.outreachScheduled!==false||
      x.paymentChanged!==false||x.modelInvoked!==false){
    setError("Owner saved-history, opt-in or suppression evidence could not be verified. No outreach was prepared.");return;
   }
   setResult(x);
  }catch{if(active.current&&seq.current===sequence)setError("Saved retention review unavailable; no customer message was queued.");}
  finally{pending.current=false;if(active.current&&seq.current===sequence)setBusy(false);}
 }
 return <section className="app-panel" aria-label="Owner consent-aware repeat-service review"
  data-testid="f20-customer-retention">
  <h2>Repeat cleaning and retention opportunities</h2>
  <p>On-demand verified saved history and explicit opted-in channels. A service gap is not proof of churn or consent to send now.</p>
  <button type="button" onClick={()=>void review()} disabled={busy} aria-busy={busy}>
   {busy?"Checking saved visits and opt-in…":"Review consent-aware repeat-service opportunities"}
  </button>
  {error?<p role="alert">{error}</p>:null}
  {result?<div role="status" aria-live="polite">
   <p>{result.candidateCount} saved customer-channel candidates found; displaying at most 25 for staff review.</p>
   {result.candidates.length?<ol>{result.candidates.map((c,i)=><li key={c.customerId+":"+c.channel}>
    <strong>Opportunity {i+1}: {c.kind==="REPEAT_CLEANING_REVIEW"?
      "Repeat-service review":"Service-gap review, not churn proof"}</strong>
    <p>Channel: {c.channel} · saved completed visits {c.savedCompletedVisitCount}.
       Consent recorded {c.consentRecordedAt}. Verify the current purpose, identity, suppression controls and quiet hours at sending time.</p>
    <Link href={buildStaffModuleHref(slug,"customers")+"?customer="+encodeURIComponent(c.customerId)}>
      Open authorized customer record</Link>
    <p><Link href={buildStaffModuleHref(slug,"jobs")+"?job="+encodeURIComponent(c.lastCompletedVisitId)}>
      Open related saved job</Link></p>
   </li>)}</ol>:<p>No eligible opted-in records were identified within this bounded saved-history read. This is not a complete database or churn report.</p>}
   <p>All suggestions remain human-reviewed. No outreach, automated follow-up, payment change or model invocation occurred.</p>
  </div>:null}
 </section>;
}
