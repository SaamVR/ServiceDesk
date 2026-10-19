"use client";
import Link from "next/link";
import {useEffect,useRef,useState} from "react";
import {buildStaffModuleHref} from "./staff-modules";
import {invoiceQueueHref} from "./invoice-collection-queue";
import {parseOwnerFinanceExceptions,ownerFinanceCodeLabels,
 type VerifiedOwnerFinanceExceptions} from "./owner-finance-exception-proof";
import styles from "./OwnerFinanceExceptionReview.module.css";

/** Opt-in read-only owner ledger exception check. Backend independently
 * authorizes OWNER and twice verifies current saved financial source.
 * This panel never infers that a payment, refund or external message happened.
 */
export function OwnerFinanceExceptionReview({workspaceSlug}:{workspaceSlug:string}){
 return <ScopedFinanceReview key={workspaceSlug} workspaceSlug={workspaceSlug}/>;
}
function ScopedFinanceReview({workspaceSlug}:{workspaceSlug:string}){
 const [value,setValue]=useState<VerifiedOwnerFinanceExceptions>();
 const [state,setState]=useState<"idle"|"loading"|"available"|"unavailable">("idle");
 const [expanded,setExpanded]=useState(false);
 const request=useRef<AbortController|null>(null);
 useEffect(()=>()=>{request.current?.abort();request.current=null;},[]);
 async function load(){
   if(request.current)return;
   const controller=new AbortController();
   request.current=controller;
   setState("loading");setValue(undefined);setExpanded(false);
   const timeout=setTimeout(()=>{
     controller.abort();
     if(request.current===controller){
       request.current=null;setState("unavailable");
     }
   },20_000);
   try{
     const response=await fetch("/api/internal/ai/finance-review",{
       method:"POST",credentials:"same-origin",cache:"no-store",
       headers:{"Content-Type":"application/json",Accept:"application/json"},
       body:JSON.stringify({workspaceSlug}),signal:controller.signal,
     });
     if(controller.signal.aborted||request.current!==controller)return;
     if(!response.ok||!response.headers.get("content-type")?.includes("application/json")){
       setState("unavailable");return;
     }
     const result=parseOwnerFinanceExceptions(await response.json() as unknown);
     if(controller.signal.aborted||request.current!==controller)return;
     if(!result){setState("unavailable");return;}
     setValue(result);setState("available");
   }catch{
     if(request.current===controller&&!controller.signal.aborted)
       setState("unavailable");
   }finally{
     clearTimeout(timeout);
     if(request.current===controller)request.current=null;
   }
 }
 const rows=value?.exceptions??[];
 const visible=expanded?rows:rows.slice(0,8);
 const invoiceHref=buildStaffModuleHref(workspaceSlug,"invoices");
 return <section className={styles.panel}
   aria-label="Owner saved-ledger exception review" data-testid="owner-finance-exception-review">
   <div className={styles.header}>
     <div><p className={styles.eyebrow}>Owner finance · deterministic source review</p>
       <h3>Saved invoice exceptions</h3>
       <p>Inspect authorized ledger inconsistencies and manual collection cases.
         This checks the database twice and uses no generative model.</p></div>
     <button type="button" className={styles.action} onClick={load}
       disabled={state==="loading"} aria-busy={state==="loading"}>
       {state==="loading"?"Checking saved ledger…":
         state==="available"?"Refresh exception review":"Check saved invoice exceptions"}
     </button>
   </div>
   {state==="idle"?<p className={styles.feedback}>
     Run a manual saved-ledger check. No payment, refund or customer message is triggered.
   </p>:null}
   {state==="loading"?<p className={styles.feedback} role="status">
     Rechecking authorized invoice ledger records…
   </p>:null}
   {state==="unavailable"?<p className={styles.error} role="alert">
     Saved finance review could not be verified. This is NOT proof that
     there are zero exceptions, that invoices were paid, or that a provider
     processed funds. Inspect the saved Invoices workspace instead.
   </p>:null}
   {value&&state==="available"?<>
     <dl className={styles.stats} aria-label="Verified finance source counts">
       <div><dt>Saved invoices inspected</dt><dd>{value.inspectedCount}</dd></div>
       <div><dt>Source review exceptions</dt><dd>{value.exceptionCount}</dd></div>
     </dl>
     {visible.length?<ol className={styles.rows}>
       {visible.map(item=><li key={item.invoiceId}>
         <div className={styles.rowHead}>
           <strong>Saved invoice ID {item.invoiceId.slice(0,8)}</strong>
           {item.priority==="HIGH"?<span className={styles.priority}>Higher priority review</span>:null}
         </div>
         {item.codes.map(code=><p key={code}>{ownerFinanceCodeLabels[code]}</p>)}
         <Link href={invoiceHref+invoiceQueueHref("all","",item.invoiceId)}>
           Open this saved invoice for manual review →
         </Link>
       </li>)}
     </ol>:<p className={styles.feedback}>
       No exception codes in this bounded saved invoice snapshot.
       This is not proof of payment settlement, customer delivery,
       or a complete business-wide audit.
     </p>}
     {rows.length>8?<button type="button" className={styles.more}
       aria-expanded={expanded} onClick={()=>setExpanded(v=>!v)}>
       {expanded?"Show first eight":"Review all "+rows.length+" exceptions"}
     </button>:null}
     <p className={styles.disclosure}>Saved, owner-authorized records only;
       up to 299 verified invoice rows. The panel contains no customer contacts,
       currency amounts or provider payment receipts. It never authorizes
       financial changes. Recheck the invoice before collecting money or
       contacting a customer.</p>
   </>:null}
 </section>;
}
