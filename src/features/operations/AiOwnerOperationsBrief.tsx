"use client";

import {useEffect,useRef,useState} from "react";
import {requestOwnerOperationsBrief} from "./owner-operations-brief-action";
import type {OwnerPriorityAction} from "@/server/ai/owner-priority-actions";

type UiState={busy:boolean;brief?:string;model?:string;
  priorityActions?:OwnerPriorityAction[];error?:string};

/** A deliberate owner-only request; the server rechecks owner membership,
 * persisted source and model configuration before returning suggestions.
 */
export function AiOwnerOperationsBrief({
  workspaceSlug, configured,
}: {workspaceSlug:string;configured:boolean}) {
  return <OwnerBriefForWorkspace key={workspaceSlug}
    workspaceSlug={workspaceSlug} configured={configured}/>;
}
function OwnerBriefForWorkspace({
  workspaceSlug,configured,
}: {workspaceSlug:string;configured:boolean}) {
  const [state,setState]=useState<UiState>({busy:false});
  const sequence=useRef(0);
  useEffect(()=>()=>{sequence.current+=1;},[]);
  async function requestBrief(){
    if(!configured || state.busy) return;
    const id=++sequence.current;
    setState({busy:true});
    try {
      const result=await requestOwnerOperationsBrief(workspaceSlug);
      if(sequence.current!==id)return;
      setState(result.ok
        ? {busy:false,brief:result.brief,model:result.model,
            priorityActions:result.priorityActions}
        : {busy:false,error:result.message});
    } catch {
      if(sequence.current!==id)return;
      setState({busy:false,error:"AI brief failed. No messages, quotes, payments or automations were changed."});
    }
  }
  return <section aria-label="Owner AI operational briefing"
    style={{marginBlock:16,border:"1px solid #d1e8df",borderRadius:14,
      background:"#f7fbf9",padding:18,display:"grid",gap:10}}>
    <strong>Owner AI · verified workday priorities</strong>
    <p style={{margin:0,fontSize:".85rem",lineHeight:1.5}}>
      Generate an optional, read-only AI checklist from the current saved
      workspace counts. No customer identity, message, business price or
      invoice amount is shared with the model. Suggestions are not actions.
    </p>
    <button type="button" disabled={!configured||state.busy}
      onClick={requestBrief} aria-busy={state.busy}
      style={{justifySelf:"start",padding:"9px 14px",border:0,
        background:"#18564a",color:"white",borderRadius:8,
        cursor:configured&&!state.busy?"pointer":"not-allowed"}}>
      {state.busy?"Checking verified operations…":"Generate owner AI priorities"}
    </button>
    {!configured ? <p role="status">A configured, explicitly enabled AI model is required. Operational records remain available without AI.</p>:null}
    {state.error?<p role="alert">{state.error}</p>:null}
    {state.brief?<div role="status" aria-live="polite">
      <p style={{margin:"0 0 6px",fontWeight:650}}>Model suggestion · {state.model}</p>
      <p style={{whiteSpace:"pre-wrap",margin:0}}>{state.brief}</p>
      {state.priorityActions && state.priorityActions.length>0 ? (
        <section aria-label="Evidence-backed owner review priorities"
          style={{marginBlock:10}}>
          <strong>Saved queue priorities · verified counts, not AI-generated tasks</strong>
          <ol style={{display:"grid",gap:8,paddingLeft:20,marginBlock:8}}>
            {state.priorityActions.map(item=>(
              <li key={item.key}>
                <a href={`/app/${encodeURIComponent(workspaceSlug)}/${item.module}`}
                  style={{fontWeight:650,color:"#18564a"}}>
                  {item.label} ({item.count})
                </a>
                <div style={{fontSize:".81rem",lineHeight:1.5}}>{item.instruction}</div>
              </li>
            ))}
          </ol>
        </section>
      ) : state.priorityActions ? (
        <p role="status">No positive-count priority buckets were verified in the saved snapshot.</p>
      ):null}
      <small>Verify each recommendation in the saved workspace. AI did not approve, send or execute anything.</small>
    </div>:null}
  </section>;
}
