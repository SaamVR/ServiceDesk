"use client";

import Link from "next/link";
import {useEffect,useRef,useState} from "react";
import {requestOwnerVerifiedWorkdayReview}
 from "./owner-verified-workday-action";
import {parseVerifiedOwnerPriorityActions,
 type VerifiedOwnerPriorityAction} from "./owner-operations-brief-proof";
import {buildStaffModuleHref} from "./staff-modules";
import styles from "./OwnerVerifiedWorkdayReview.module.css";

type VerifiedReview={
 priorities:VerifiedOwnerPriorityAction[];
 overdueCount:number;unscheduledCount:number;
};
const WAIT_MS=30_000;

/** Unlike a generative brief this panel NEVER invokes a paid AI model.
 * It only requests a signed-in owner/tenant-authorized source double read.
 */
export function OwnerVerifiedWorkdayReview({workspaceSlug,workspaceId}:{
 workspaceSlug:string;workspaceId?:string;
}){
 const scope=workspaceSlug+":"+(workspaceId??"unverified");
 return <ScopedOwnerVerifiedWorkdayReview key={scope} workspaceSlug={workspaceSlug}/>;
}
function ScopedOwnerVerifiedWorkdayReview({workspaceSlug}:{workspaceSlug:string}){
 const [result,setResult]=useState<VerifiedReview>();
 const [status,setStatus]=useState<"idle"|"reading"|"stopped"|"ready"|"error">("idle");
 const [error,setError]=useState("");
 const sequence=useRef(0);
 const active=useRef<{id:number;timer:ReturnType<typeof setTimeout>}|null>(null);
 useEffect(()=>()=>{sequence.current++;if(active.current)clearTimeout(active.current.timer);
  active.current=null;},[]);
 const occupied=status==="reading"||status==="stopped";
 async function load(){
  if(active.current||occupied)return;
  const id=++sequence.current;
  const timer=setTimeout(()=>{
   if(active.current?.id!==id||sequence.current!==id)return;
   sequence.current++;
   setResult(undefined);setStatus("stopped");
   setError("This saved-source review is taking longer than 30 seconds. The browser stopped waiting; the server read may still be in progress. A repeat request is blocked until it finishes.");
  },WAIT_MS);
  active.current={id,timer};
  setResult(undefined);setError("");setStatus("reading");
  try{
   const response=await requestOwnerVerifiedWorkdayReview(workspaceSlug);
   if(sequence.current!==id||active.current?.id!==id)return;
   const priorities=response.ok?parseVerifiedOwnerPriorityActions(response.priorities):null;
   if(!response.ok || response.state!=="SAVED_WORKDAY_REVIEW_ONLY" ||
      response.source!=="DOUBLE_CHECKED_SAVED_WORKSPACE_COUNTS" ||
      response.manualReviewRequired!==true || response.modelInvoked!==false ||
      response.workflowExecuted!==false || response.customerMessaged!==false ||
      response.paymentChanged!==false || !priorities ||
      !Number.isSafeInteger(response.overdueCount)||response.overdueCount<0 ||
      !Number.isSafeInteger(response.unscheduledCount)||response.unscheduledCount<0){
    setResult(undefined);setStatus("error");
    setError("The authorized owner workday source is unavailable or changed. Use the saved queues and retry deliberately.");
    return;
   }
   setResult({priorities,overdueCount:response.overdueCount,
    unscheduledCount:response.unscheduledCount});
   setStatus("ready");
  }catch{
   if(sequence.current===id){setStatus("error");
    setError("The saved workday review failed. No model call, message or financial action was authorized.");}
  }finally{
   clearTimeout(timer);
   if(active.current?.id===id){
    active.current=null;
    if(sequence.current!==id){
     setStatus("error");
     setError("The previous review request has finished. Its late result was discarded; you may run a new saved-queue review.");
    }
   }
  }
 }
 return <section className={styles.panel} aria-label="Owner model-free saved workday priorities">
  <div className={styles.heading}>
   <div><span className={styles.eyebrow}>No AI subscription required</span>
    <h3>Review your verified workday</h3>
    <p>Double-check saved requests, quote queues, invoices, visits and due attention.
      This does not create or assign tasks, publish rules or contact customers.</p>
   </div>
   <span className={styles.badge}>Saved records · manual review</span>
  </div>
  <button type="button" className={styles.load} onClick={()=>void load()}
   disabled={occupied} aria-busy={status==="reading"}>
   {status==="reading"?"Checking saved queues…" :
    status==="stopped"?"Source read still outstanding" :
    result?"Refresh verified workday":"Review saved workday"}
  </button>
  {error?<p className={styles.error} role="alert">{error}</p>:null}
  {status==="ready"&&result?<section className={styles.results}
    role="status" aria-live="polite" aria-label="Verified owner workday review">
   <p className={styles.summary}>Saved attention: {result.overdueCount} overdue,
    {" "}{result.unscheduledCount} without a due date. Confirm individually in the
    authoritative queue before taking action.</p>
   {result.priorities.length?<ol className={styles.priorities}>
    {result.priorities.map(item=><li key={item.key}>
     <span className={styles.count}>{item.count}</span>
     <div><strong>{item.title}</strong>
      <p>{item.detail}</p>
      <Link href={buildStaffModuleHref(workspaceSlug,item.module)}>
       Review saved queue</Link></div>
    </li>)}
   </ol>:<p>No positive priority categories were returned by the verified
      source. This does not prove all work is complete.</p>}
   <p className={styles.footer}>Double-checked saved counts only; not an AI
    recommendation, provider receipt, resolved issue or executed automation.</p>
  </section>:null}
 </section>;
}
