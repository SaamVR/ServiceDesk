"use client";

import {useEffect,useRef,useState} from "react";
import {automationPlaybooks} from "./automation-playbooks";
import {previewOwnerAutomationStarters,type OwnerStarterBatchPreview}
 from "./owner-starter-batch-preview-action";
import styles from "./OwnerStarterBatchWorkbench.module.css";

type Branch={id:string;name:string};
type Props={workspaceSlug:string;workspaceId:string;branches:readonly Branch[]};

/** Owner-selected static catalogue only; no AI, save, publish or live event. */
export function OwnerStarterBatchWorkbench(props:Props){
 const scope=[props.workspaceId,props.workspaceSlug,...props.branches.map(b=>b.id)].join(":");
 return <ScopedOwnerStarterBatchWorkbench key={scope} {...props}/>;
}
function ScopedOwnerStarterBatchWorkbench({workspaceSlug,branches}:Props){
 const [branchId,setBranchId]=useState(branches[0]?.id??"");
 const [selected,setSelected]=useState<string[]>([]);
 const [result,setResult]=useState<OwnerStarterBatchPreview|null>(null);
 const [busy,setBusy]=useState(false);
 const [feedback,setFeedback]=useState("");
 const requestSequence=useRef(0),pending=useRef(false);
 useEffect(()=>()=>{
  requestSequence.current+=1;
  pending.current=false;
 },[]);
 const clear=()=>{
  requestSequence.current+=1;
  pending.current=false;
  setResult(null);
  setBusy(false);
  setFeedback("");
 };
 const toggle=(id:string)=>{
  clear();
  setSelected(values=>values.includes(id)?
    values.filter(x=>x!==id):
    values.length>=12?values:[...values,id]);
 };
 const run=async()=>{
  if(pending.current||selected.length===0||selected.length>12||!branchId)return;
  pending.current=true;
  const sequence=++requestSequence.current;
  const selectedIds=[...selected];
  setBusy(true);setResult(null);
  setFeedback("Checking saved owner and branch authority for internal draft previews…");
  try{
   const response=await previewOwnerAutomationStarters({
    workspaceSlug,branchId,starterIds:selectedIds,
   });
   if(sequence!==requestSequence.current)return;
   if(!response.ok || response.branchId!==branchId ||
      response.selectedCount!==selectedIds.length ||
      response.published!==false || response.persisted!==false ||
      response.providerMessagesSent!==false || response.paidModelInvoked!==false){
    setFeedback("Owner starter preview was not authorized or saved branch evidence changed.");
    setResult(null);
   }else{
    setResult(response);
    setFeedback("Verified saved branch. Internal draft previews only — no rule was installed.");
   }
  }catch{
   if(sequence===requestSequence.current){
    setResult(null);setFeedback("Owner starter preview unavailable. No business action ran.");
   }
  }finally{
   if(sequence===requestSequence.current){
    pending.current=false;setBusy(false);
   }
  }
 };
 return <section className={styles.panel} aria-label="Owner bulk automation starter review">
  <header className={styles.heading}>
   <div><p className={styles.eyebrow}>Owner automation · internal-only batch</p>
    <h3>Prepare several workflow starters for review</h3>
    <p>Choose up to 12 of 27 fixed recipes. A saved-branch check creates a
      read-only draft preview, never a published automation or customer message.</p>
   </div><strong className={styles.count}>{selected.length} / 12 selected</strong>
  </header>
  <label className={styles.branch}>Authorized branch
   <select value={branchId} onChange={event=>{clear();setBranchId(event.target.value);}}
    disabled={!branches.length || busy}>
    {branches.length?branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>):
     <option value="">No authorized branch available</option>}
   </select>
  </label>
  <div className={styles.options} role="group" aria-label="Choose internal automation starters">
   {automationPlaybooks.map(item=><label key={item.id} className={styles.option}>
    <input type="checkbox" checked={selected.includes(item.id)}
     onChange={()=>toggle(item.id)}
     disabled={!selected.includes(item.id)&&selected.length>=12}/>
    <span><strong>{item.name}</strong>
     <small>{item.category} · {item.eventType.replaceAll("_"," ")} · {item.severity}</small></span>
   </label>)}
  </div>
  <div className={styles.controls}>
   <button type="button" disabled={busy||!branchId||selected.length<1}
    onClick={()=>void run()}> {busy?"Checking saved branch…":"Preview selected internal drafts"}</button>
   <button type="button" className={styles.secondary}
    disabled={busy||!selected.length} onClick={()=>{clear();setSelected([]);}}>
    Clear selection
   </button>
  </div>
  <p role="status" aria-live="polite" className={styles.feedback}>{feedback}</p>
  {result?.ok ? <section className={styles.preview} aria-label="Unpublished owner batch preview">
   <h4>{result.drafts.length} internal rule drafts · not persisted</h4>
   <ul>{result.drafts.map(d=>{
    const item=automationPlaybooks.find(p=>p.id===d.starterId);
    return <li key={d.starterId}><strong>{item?.name??d.code}</strong>
     <p>On {d.eventType.replaceAll("_"," ")} → CREATE_ATTENTION:
       {" "}{d.actions[0]?.summaryKey} ({d.actions[0]?.severity})</p>
     <small>{d.conditions.length ? d.conditions.map(c=>
       `${c.field} ${c.operator} ${String(c.value)}`).join(" · ") :
       "No condition. Owner must separately review and publish any saved rule."}</small>
    </li>;
   })}</ul>
   <p className={styles.disclosure}>Nothing has been installed, published,
     executed, charged or delivered. Use the existing workflow editor to
     review, save and explicitly publish individual rules.</p>
  </section>:null}
  <p className={styles.disclosure}>The preview is tied to the currently signed-in
    owner, active saved workspace branch and a second authorization read.
    Choosing a starter never calls a paid model, touches invoices or queues
    email/WhatsApp delivery.</p>
 </section>;
}
