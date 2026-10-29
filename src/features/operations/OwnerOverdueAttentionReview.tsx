"use client";

import {useEffect,useRef,useState} from "react";
import Link from "next/link";
import {requestOwnerOverdueAttentionReview} from "./owner-attention-review-action";
import type {OwnerAttentionReviewProjection} from "./owner-attention-review-projection";
import {buildStaffModuleHref} from "./staff-modules";
import styles from "./OwnerOverdueAttentionReview.module.css";

const WAIT_MS=30_000;
/** Owner-only route mounts this bounded, explicit read. Never auto-loads
 * and never calls a provider/model/retry or mutates any saved workflow. */
export function OwnerOverdueAttentionReview({workspaceSlug}:{workspaceSlug:string}){
 const [status,setStatus]=useState<"idle"|"loading"|"stalled"|"ready"|"error">("idle");
 const [result,setResult]=useState<Extract<OwnerAttentionReviewProjection,{ok:true}>>();
 const active=useRef<{id:number;timer:ReturnType<typeof setTimeout>;timedOut:boolean}|null>(null);
 const requestId=useRef(0);
 useEffect(()=>()=>{requestId.current++;if(active.current)clearTimeout(active.current.timer);active.current=null;},[]);
 const occupied=status==="loading"||status==="stalled";
 async function load(){
  if(active.current||occupied)return;
  const id=++requestId.current;
  active.current={id,timedOut:false,timer:setTimeout(()=>{
   if(active.current?.id!==id)return;
   active.current.timedOut=true;
   setStatus("stalled");setResult(undefined);
   // Keep one inflight request only; a late response is never presented
   // as current evidence after the browser stopped waiting.
  },WAIT_MS)};
  setResult(undefined);setStatus("loading");
  try{
   const reply=await requestOwnerOverdueAttentionReview(workspaceSlug);
   if(active.current?.id!==id)return;
   if(reply.ok===true && reply.state==="SAVED_OWNER_ATTENTION_REVIEW_ONLY" &&
      reply.source==="DOUBLE_CHECKED_SAVED_ATTENTION_ROWS" &&
      reply.ownerReviewRequired===true && reply.modelInvoked===false &&
      reply.workflowExecuted===false && reply.providerDeliveryVerified===false &&
      reply.customerMessaged===false && reply.moneyChanged===false &&
      Number.isSafeInteger(reply.overdueCount) &&
      Number.isSafeInteger(reply.unscheduledCount) &&
      Array.isArray(reply.visible) && reply.visible.length<=6 &&
      reply.visible.length+reply.omittedCount===reply.overdueCount){
    // If the timer already marked this read stale, discard it. It can
    // never turn a timed-out snapshot into a current “no alerts” claim.
    if(!active.current.timedOut){setResult(reply);setStatus("ready");}
    else{setStatus("error");setResult(undefined);}
   }else{setStatus("error");setResult(undefined);}
  }catch{if(active.current?.id===id){setStatus("error");setResult(undefined);}}
  finally{
   if(active.current?.id===id){
    const timedOut=active.current.timedOut;
    clearTimeout(active.current.timer);active.current=null;
    if(timedOut)setStatus("error");
   }
  }
 }
 return <section className={styles.panel}
   aria-label="Owner saved overdue attention exception review">
  <header>
   <p className={styles.eyebrow}>Owner attention · verified read only</p>
   <h3>Inspect overdue internal exceptions</h3>
   <p>This optional check re-reads your saved attention queue under your owner session.
     No AI request, customer send, automatic replay or task assignment occurs.</p>
  </header>
  <button type="button" className={styles.load} disabled={occupied}
   aria-busy={status==="loading"} onClick={()=>void load()}>
   {status==="loading"?"Checking saved attention…" :
     status==="stalled"?"Prior read still finishing" :
     result?"Refresh saved exceptions":"Review overdue exceptions"}
  </button>
  {status==="stalled"?<p role="alert">
    The saved-source check exceeded 30 seconds. Its result will not be trusted as
    current. Recheck after the previous request has finished.
  </p>:null}
  {status==="error"?<p className={styles.warning} role="alert">
    Saved attention could not be independently verified. This is not a clear
    queue. Review the authoritative Overview and retry when ready.
  </p>:null}
  {status==="ready"&&result?<section className={styles.output}
   role="status" aria-live="polite" aria-label="Double-checked saved owner exceptions">
   <p><strong>{result.overdueCount}</strong> saved overdue attention records;
     {" "}<strong>{result.unscheduledCount}</strong> open records with no due time.
     Both require individual operator review, not automatic resolution.</p>
   {result.visible.length>0?<ol>
    {result.visible.map((item,index)=><li key={index}>
      <strong>{item.severity} · {item.status}</strong>
      <span>Due {item.dueAt}; at least {item.overdueMinutes} whole minutes overdue
        at the verified snapshot.</span>
    </li>)}
   </ol>:<p>No overdue rows in this bounded verified read. Not an all-clear for
      other queues or subsequent changes.</p>}
   {result.omittedCount>0?<p>{result.omittedCount} additional overdue records
     omitted from this bounded preview. Review the full saved queue.</p>:null}
   <Link href={buildStaffModuleHref(workspaceSlug,"overview")}>
     Open authoritative attention queue</Link>
   <small>Saved owner evidence only. Provider delivery, human resolution,
     model inference and unattended execution have not been verified.</small>
  </section>:null}
 </section>;
}
