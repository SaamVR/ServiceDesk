"use client";
import {useEffect,useRef,useState} from "react";
import Link from "next/link";
import {requestF16GroundedQuoteReview,type F16GroundedQuoteResult}
 from "./f16-grounded-quote-review-action";
import {buildStaffModuleHref} from "./staff-modules";
export function AiGroundedQuoteAlternatives({workspaceSlug,requestId}:{
 workspaceSlug:string;requestId:string;
}){
 return <ScopedQuotes key={workspaceSlug+":"+requestId}
  workspaceSlug={workspaceSlug} requestId={requestId}/>;
}
function ScopedQuotes({workspaceSlug,requestId}:{workspaceSlug:string;requestId:string}){
 const [result,setResult]=useState<Extract<F16GroundedQuoteResult,{ok:true}>>();
 const [error,setError]=useState(""),[busy,setBusy]=useState(false);
 const pending=useRef(false),mounted=useRef(true),sequence=useRef(0);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;sequence.current++;};},[]);
 async function review(){
  if(pending.current)return;
  pending.current=true;setBusy(true);setResult(undefined);setError("");
  const seq=++sequence.current;
  try{
   const r=await requestF16GroundedQuoteReview(workspaceSlug,requestId);
   if(!mounted.current||sequence.current!==seq)return;
   if(!r.ok||r.state!=="GROUND_PRICE_REVIEW_ONLY"||
      r.staffApprovalRequired!==true||r.quoteCreated!==false||
      r.modelInvoked!==false||r.customerMessaged!==false||r.priceBookChanged!==false){
     setError("No verified saved branch price book or current request evidence is available. Set real prices and reopen the request.");return;
   }
   setResult(r);
  }catch{if(mounted.current&&sequence.current===seq)setError("Saved quote alternatives are unavailable. No quote or message was created.");}
  finally{pending.current=false;if(mounted.current&&sequence.current===seq)setBusy(false);}
 }
 const money=(minor:number,currency:string)=>{
  try{return new Intl.NumberFormat(undefined,{style:"currency",currency}).format(minor/100);}
  catch{return currency+" "+(minor/100).toFixed(2);}
 };
 return <section aria-label="Verified branch pricing suggestions" data-testid="f16-grounded-quotes">
  <h4>Real branch-priced alternatives · staff review</h4>
  <p>Uses only verified saved rates and your current enquiry. These are nonbinding choices; ServiceDesk will not generate a quote from missing prices.</p>
  <button type="button" onClick={()=>void review()} disabled={busy} aria-busy={busy}>
   {busy?"Rechecking active branch rate book…":"Review verified quote alternatives"}
  </button>
  {error?<p role="alert">{error}{" "}
   <Link href={buildStaffModuleHref(workspaceSlug,"settings")+"?section=services"}>Open service pricing</Link>
  </p>:null}
  {result?<div role="status" aria-live="polite">
   <p>Saved request revision {result.requestVersion}. Staff must choose and confirm the service, add-ons and final terms in the authoritative quote workflow.</p>
   <ul>{result.options.map(o=><li key={o.serviceCode+":"+o.variant}>
    <strong>{o.serviceCode.replaceAll("_"," ")} · {o.variant.replaceAll("_"," ")}</strong>
    <span> {money(o.totalMinor,o.currency)} total · {money(o.depositMinor,o.currency)} deposit · {o.durationMinutes} service minutes</span>
    {o.requiresStaffServiceSelection||o.requiresStaffAddonConfirmation||o.requiresSpecialistReview?
      <p>Explicit staff review required for service choice, add-on or specialist requirement.</p>:null}
   </li>)}</ul>
   <p>No customer quote was created, approved, sent or charged. Source prices and rate versions must be revalidated at issue time.</p>
   <Link href={buildStaffModuleHref(workspaceSlug,"quotes")}>Open saved quote workflow</Link>
  </div>:null}
 </section>;
}
