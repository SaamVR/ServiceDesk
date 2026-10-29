"use client";
import {useEffect,useRef,useState} from "react";
import {requestF15SavedBusinessReview,type F15SavedBusinessReview} from "./f15-saved-business-review-action";
import Link from "next/link";
import {buildStaffModuleHref} from "./staff-modules";
export function AiSavedBusinessReview({workspaceSlug}:{workspaceSlug:string}){
 return <ScopedBI key={workspaceSlug} workspaceSlug={workspaceSlug}/>;
}
function ScopedBI({workspaceSlug}:{workspaceSlug:string}){
 const [value,setValue]=useState<Extract<F15SavedBusinessReview,{ok:true}>>();
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 const pending=useRef(false),alive=useRef(true),serial=useRef(0);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;serial.current++;};},[]);
 async function review(){
  if(pending.current)return;
  pending.current=true;setBusy(true);setValue(undefined);setError("");
  const seq=++serial.current;
  try{
   const result=await requestF15SavedBusinessReview(workspaceSlug);
   if(!alive.current||seq!==serial.current)return;
   if(!result.ok||result.state!=="SAVED_BI_REVIEW_ONLY"||
      result.completeHistoryVerified!==false||result.revenueVerified!==false||
      result.manualReviewRequired!==true||result.financialChanges!==false||
      result.messagesSent!==false||result.modelInvoked!==false){
    setError("Owner-only saved business counts are unavailable or changed.");return;
   }
   setValue(result);
  }catch{if(alive.current&&seq===serial.current)setError("Saved business review unavailable. No model call or financial action was made.");}
  finally{pending.current=false;if(alive.current&&seq===serial.current)setBusy(false);}
 }
 return <section aria-label="Saved daily and weekly operations intelligence" data-testid="f15-saved-bi">
  <h3>Daily and weekly work · verified owner review</h3>
  <p>Owner-only UTC civil-day counts from bounded saved requests and visits. No model subscription required.</p>
  <button type="button" onClick={()=>void review()} disabled={busy} aria-busy={busy}>
   {busy?"Rechecking saved counts…":"Review saved daily / weekly activity"}
  </button>
  {error?<p role="alert">{error}</p>:null}
  {value?<div role="status" aria-live="polite">
    <p>Today (UTC {value.daily.utcDay}): {value.daily.requests} requests created, {value.daily.visits} non-cancelled visit starts.</p>
    <p>Last seven UTC days: {value.weekly.requests} requests created, {value.weekly.visits} non-cancelled visit starts.</p>
    <ol>{value.weekly.days.map(d=><li key={d.utcDay}>{d.utcDay}: {d.requests} requests · {d.visits} visit starts</li>)}</ol>
    <p>History may be truncated. These counts do not verify revenue, payments, completed work or future deadlines.</p>
    <Link href={buildStaffModuleHref(workspaceSlug,"reports")}>Open authoritative reports</Link>
  </div>:null}
 </section>;
}
