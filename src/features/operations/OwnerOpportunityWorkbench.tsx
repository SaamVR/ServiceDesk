"use client";
import Link from "next/link";
import {useEffect,useRef,useState} from "react";
import {requestOwnerOpportunityPreview} from "./owner-opportunity-preview-action";
import {requestOwnerWorkflowWhatIf} from "./owner-rule-whatif-action";
import {parseOwnerOpportunityPreview,type VerifiedOwnerOpportunityPreview}
 from "./owner-opportunity-preview-proof";
import {parseOwnerWhatIfResponse,type VerifiedOwnerWhatIf}
 from "./owner-rule-browser-proof";
import {buildStaffModuleHref} from "./staff-modules";
import styles from "./OwnerOpportunityWorkbench.module.css";

type Branch={id:string;name:string};
type Props={workspaceSlug:string;workspaceId:string;branches:readonly Branch[]};
export function OwnerOpportunityWorkbench(props:Props){
 const key=[props.workspaceSlug,props.workspaceId,...props.branches.map(x=>x.id)].join("|");
 return <ScopedWorkbench key={key} {...props}/>;
}
function ScopedWorkbench({workspaceSlug,workspaceId,branches}:Props){
 const [branchId,setBranchId]=useState(branches[0]?.id??"");
 const [result,setResult]=useState<VerifiedOwnerOpportunityPreview|null>(null);
 const [preview,setPreview]=useState<{key:string;value:VerifiedOwnerWhatIf}|null>(null);
 const [busy,setBusy]=useState(false);
 const [previewBusy,setPreviewBusy]=useState(false);
 const [message,setMessage]=useState("Choose an authorized branch and inspect verified saved workday signals.");
 const pending=useRef(false),previewPending=useRef(false),seq=useRef(0);
 useEffect(()=>()=>{seq.current++;pending.current=false;previewPending.current=false;},[]);
 const reset=(selected:string)=>{
  seq.current++;setBranchId(selected);setResult(null);setPreview(null);
  setMessage("Branch changed. Generate a fresh owner-scoped review.");
  setBusy(false);setPreviewBusy(false);
  // Pending network requests are not cancelled upstream. They are ignored by the UI.
 };
 async function inspect(){
  if(pending.current||previewPending.current||!branches.some(x=>x.id===branchId))return;
  pending.current=true;const attempt=++seq.current;
  setBusy(true);setResult(null);setPreview(null);
  setMessage("Double-checking signed-in owner, active saved branch and workday evidence…");
  try{
   const response=await requestOwnerOpportunityPreview({workspaceSlug,branchId});
   if(seq.current!==attempt)return;
   const parsed=parseOwnerOpportunityPreview(response,{workspaceId,branchId});
   if(!parsed){setMessage("Saved owner or branch evidence could not be verified. No rule was drafted.");return;}
   setResult(parsed);
   setMessage(parsed.suggestions.length?
     "Future-event internal rule ideas are ready for hypothetical review. Existing records are untouched.":
     "No supported positive signals were found. This is not proof that all queues are clear.");
  }catch{
   if(seq.current===attempt)setMessage("Source review unavailable. No rule was published or business task created.");
  }finally{
   pending.current=false;
   if(seq.current===attempt)setBusy(false);
  }
 }
 async function simulate(item:VerifiedOwnerOpportunityPreview["suggestions"][number]){
  if(previewPending.current||pending.current||!result||!branches.some(x=>x.id===branchId)||
     !result.suggestions.some(x=>x.key===item.key))return;
  previewPending.current=true;const attempt=++seq.current;
  setPreview(null);setPreviewBusy(true);
  setMessage("Evaluating a fictional future event using the existing protected rule preview…");
  try{
   const raw=await requestOwnerWorkflowWhatIf({workspaceSlug,branchId,
    candidate:{eventType:item.eventType,severity:item.severity},
    sampleServiceCode:"NONE"});
   if(seq.current!==attempt)return;
   const parsed=parseOwnerWhatIfResponse(raw,{eventType:item.eventType});
   if(!parsed){setMessage("Hypothetical preview was denied or authorization changed. No event executed.");return;}
   setPreview({key:item.key,value:parsed});
   setMessage("Synthetic preview complete. This did not query or process a historical customer event.");
  }catch{
   if(seq.current===attempt)setMessage("Preview unavailable. Nothing was executed, saved or published.");
  }finally{
   previewPending.current=false;if(seq.current===attempt)setPreviewBusy(false);
  }
 }
 return <section className={styles.panel} aria-label="Owner saved-signal automation opportunities">
  <div className={styles.header}>
   <div><p className={styles.eyebrow}>SONIC / Owner automation / Model-free</p>
    <h2>Find the next useful internal automation</h2>
    <p>Use real saved queue counts to propose future-event internal reviews. No paid model calls, automatic publication or contact with customers.</p>
   </div><span className={styles.badge}>Owner review only</span>
  </div>
  <div className={styles.controls}>
   <label>Verified workspace branch
    <select value={branchId} disabled={!branches.length||busy||previewBusy}
      onChange={e=>{if(branches.some(b=>b.id===e.target.value))reset(e.target.value);}}>
     {branches.length?branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>):
       <option value="">No branch available</option>}
    </select>
   </label>
   <button type="button" onClick={()=>void inspect()}
    disabled={!branchId||busy||previewBusy||pending.current} aria-busy={busy}>
    {busy?"Checking saved evidence…":result?"Refresh owner opportunities":"Review opportunities"}
   </button>
  </div>
  <p className={styles.status} role="status" aria-live="polite">{message}</p>
  {result?<div className={styles.results} aria-label="Future automation review suggestions">
   <p>{result.inspectedPriorities} saved workday priority categories inspected;
    {" "}{result.suggestions.length} supported future-event idea(s). Source truth must be rechecked when saving a real rule.</p>
   {!result.suggestions.length?<p>No supported source signal is positive. Open the verified queues for other work.</p>:null}
   <div className={styles.cards}>{result.suggestions.map(item=><article key={item.key} className={styles.card}>
    <p className={styles.eyebrow}>{item.severity} internal review · {item.count} saved queue item(s)</p>
    <h3>{item.title}</h3>
    <p>{item.description}</p>
    <p className={styles.rule}>Future {item.eventType.replaceAll("_"," ")}
      {" → "}CREATE_ATTENTION: {item.summaryKey}</p>
    <div className={styles.cardActions}>
     <button type="button" disabled={busy||previewBusy||previewPending.current}
      onClick={()=>void simulate(item)}>Preview fictional event</button>
     <Link href={buildStaffModuleHref(workspaceSlug,item.module)}>Inspect saved queue</Link>
    </div>
    {preview?.key===item.key?<p className={styles.preview} role="status">
      Synthetic engine result: {preview.value.matched?"rule conditions matched":"rule conditions did not match"}.
      {" "}{preview.value.wouldCreateAttention?"An internal attention would be proposed.":"No internal attention would be proposed."}
      {" "}No execution, customer message or publication occurred.
    </p>:null}
   </article>)}</div>
  </div>:null}
  <p className={styles.disclaimer}>These are future-rule suggestions only; existing queue items are not processed.
    Saving or publishing a rule requires the separate owner workflow editor and approvals.
    No current provider delivery, AI response, payment or saved execution is claimed.
    {" "}<Link href={buildStaffModuleHref(workspaceSlug,"automations")}>Return to Automation Studio</Link>
  </p>
 </section>;
}
