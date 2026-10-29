"use client";
import Link from "next/link";
import {useEffect,useRef,useState} from "react";
import {requestF20OwnerFinanceReview,type F20FinanceReply} from "./f20-owner-finance-review-action";
import {buildStaffModuleHref} from "./staff-modules";
export function OwnerLedgerExceptionReview({workspaceSlug}:{workspaceSlug:string}){
 return <ScopedLedger key={workspaceSlug} slug={workspaceSlug}/>;
}
function ScopedLedger({slug}:{slug:string}){
 const [result,setResult]=useState<Extract<F20FinanceReply,{ok:true}>>();
 const [error,setError]=useState(""),[busy,setBusy]=useState(false);
 const mounted=useRef(true),pending=useRef(false),serial=useRef(0);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;serial.current++;};},[]);
 async function inspect(){
  if(pending.current)return;
  pending.current=true;setBusy(true);setResult(undefined);setError("");
  const seq=++serial.current;
  try{
   const x=await requestF20OwnerFinanceReview(slug);
   if(!mounted.current||seq!==serial.current)return;
   if(!x.ok||x.state!=="AUTHORIZED_LEDGER_EXCEPTIONS_FOR_REVIEW"||
      x.humanReviewRequired!==true||x.paymentConfirmed!==false||
      x.refundAuthorized!==false||x.financialWrites!==false||
      x.messagesSent!==false||x.modelInvoked!==false){
    setError("Current saved ledger evidence or owner authority cannot be verified. Reload Invoices.");return;
   }
   setResult(x);
  }catch{if(mounted.current&&seq===serial.current)setError("Saved finance review is unavailable. No payment, refund or customer communication occurred.");}
  finally{pending.current=false;if(mounted.current&&seq===serial.current)setBusy(false);}
 }
 return <section className="app-panel" aria-label="Owner saved invoice exception explanations"
   data-testid="f20-ledger-exceptions">
  <h2>Owner ledger exception review</h2>
  <p>Read-only verified saved invoice ledger. No AI subscription, financial settlement or payment action.</p>
  <button type="button" onClick={()=>void inspect()} disabled={busy} aria-busy={busy}>
   {busy?"Checking saved invoice ledger…":"Review saved finance exceptions"}
  </button>
  {error?<p role="alert">{error}</p>:null}
  {result?<div role="status" aria-live="polite">
   <p>Inspected {result.inspectedCount} saved invoice records; {result.exceptionCount} require manual attention.</p>
   {result.cases.length?<ol>{result.cases.map(x=><li key={x.invoiceId}>
    <p><strong>{x.priority==="HIGH"?"Priority reconciliation":"Staff follow-up"}</strong></p>
    <ul>{x.reasons.map(r=><li key={r.code}>
      <strong>{r.code.replaceAll("_"," ").toLowerCase()}</strong> — {r.explanation}
      <p>{r.staffAction}</p>
    </li>)}</ul>
    <Link href={buildStaffModuleHref(slug,"invoices")+"?invoice="+encodeURIComponent(x.invoiceId)}>
      Open exact saved invoice in authoritative ledger</Link>
   </li>)}</ol>:<p>No exceptions detected among the bounded saved invoices inspected. No payment-provider settlement was verified.</p>}
   <p>No paid status, refund, balance write or external message was authorized.</p>
  </div>:null}
 </section>;
}
