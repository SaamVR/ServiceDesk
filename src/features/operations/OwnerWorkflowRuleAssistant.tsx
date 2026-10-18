"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { buildStaffModuleHref } from "./staff-modules";
import {
  validateOwnerRuleIntent, parseOwnerWorkflowSuggestion,
  parseOwnerWhatIfResponse, type VerifiedOwnerRuleSuggestion,
  type VerifiedOwnerWhatIf, type SuggestedServiceCode,
} from "./owner-rule-browser-proof";
import { requestOwnerWorkflowWhatIf } from "./owner-rule-whatif-action";
import styles from "./OwnerWorkflowRuleAssistant.module.css";

export interface OwnerRuleBranchOption {id:string;name:string}
type Props={workspaceSlug:string;workspaceId:string;configured:boolean;
  branches:readonly OwnerRuleBranchOption[]};
const WAIT_LIMIT_MS=75_000;
const defaultIntent="When a quote is accepted create an internal dispatch review task.";

export function OwnerWorkflowRuleAssistant(props:Props){
  const scope=[props.workspaceSlug,props.workspaceId,String(props.configured),
    ...props.branches.map(item=>item.id)].join(":");
  return <ScopedOwnerRuleAssistant key={scope} {...props}/>;
}

/** The selected branch and generated model draft never outlive their owner
 * workspace/scope. Server independently reauthorizes every request and preview. */
function ScopedOwnerRuleAssistant({workspaceSlug,workspaceId,configured,branches}:Props) {
  const [branchId,setBranchId]=useState(branches[0]?.id ?? "");
  const [instruction,setInstruction]=useState(defaultIntent);
  const [busy,setBusy]=useState(false);
  const [previewBusy,setPreviewBusy]=useState(false);
  const [feedback,setFeedback]=useState("");
  const [suggestion,setSuggestion]=useState<VerifiedOwnerRuleSuggestion>();
  const [preview,setPreview]=useState<VerifiedOwnerWhatIf>();
  const [sampleCode,setSampleCode]=useState<"NONE"|SuggestedServiceCode>("STANDARD");
  const activeRequest=useRef<AbortController|null>(null);
  const sequence=useRef(0);
  const previewSequence=useRef(0);

  useEffect(()=>()=> {
    activeRequest.current?.abort();
    activeRequest.current=null;
    sequence.current+=1;
    previewSequence.current+=1;
  },[]);

  function invalidate() {
    activeRequest.current?.abort();
    activeRequest.current=null;
    sequence.current+=1;
    previewSequence.current+=1;
    setBusy(false);
    setPreviewBusy(false);
    setSuggestion(undefined);
    setPreview(undefined);
    setFeedback("");
  }
  const safeIntent=validateOwnerRuleIntent(instruction);
  const canGenerate=configured && Boolean(safeIntent) && Boolean(branchId) &&
    !busy && !previewBusy;

  async function suggest() {
    if(!canGenerate || !safeIntent) return;
    invalidate();
    const currentId=++sequence.current;
    const controller=new AbortController();
    activeRequest.current=controller;
    const selected=branchId;
    setBusy(true);
    setFeedback("Requesting an owner-reviewed rule from the configured model…");
    const timer=setTimeout(()=>{
      controller.abort();
      if(activeRequest.current===controller){
        activeRequest.current=null;
        setBusy(false);
        setFeedback("The browser stopped waiting after 75 seconds. Upstream model cancellation or zero usage cost is not confirmed; no rule was saved.");
      }
    },WAIT_LIMIT_MS);
    try{
      const response=await fetch("/api/internal/ai/workflow-suggestion",{
        method:"POST",credentials:"same-origin",cache:"no-store",
        headers:{"Content-Type":"application/json",Accept:"application/json"},
        body:JSON.stringify({workspaceSlug,branchId:selected,instruction:safeIntent}),
        signal:controller.signal,
      });
      if(controller.signal.aborted || activeRequest.current!==controller ||
         sequence.current!==currentId)return;
      if(!response.ok || !response.headers.get("content-type")?.includes("application/json")){
        setFeedback("The owner rule suggestion was unavailable. Confirm owner access, selected branch and AI configuration; no rule was saved.");
        return;
      }
      const parsed=parseOwnerWorkflowSuggestion(
        await response.json() as unknown,{workspaceId,branchId:selected});
      if(controller.signal.aborted || activeRequest.current!==controller ||
         sequence.current!==currentId)return;
      if(!parsed){
        setFeedback("Model response failed the strict internal-only rule contract. No rule was created.");
        return;
      }
      setSuggestion(parsed);
      setFeedback("Typed internal-attention draft compiled for owner review. Not saved or published.");
    }catch{
      if(!controller.signal.aborted && activeRequest.current===controller)
        setFeedback("No verified model suggestion was returned. No workflow was created.");
    }finally{
      clearTimeout(timer);
      if(activeRequest.current===controller){
        activeRequest.current=null;
        setBusy(false);
      }
    }
  }

  function stopWaiting(){
    if(!activeRequest.current)return;
    const controller=activeRequest.current;
    activeRequest.current=null;
    sequence.current+=1;
    controller.abort();
    setBusy(false);
    setFeedback("Stopped this browser request. The model may still finish upstream; no rule was saved or published from this interface.");
  }

  async function runPreview(){
    if(!suggestion || previewBusy || busy || suggestion.branchId!==branchId)return;
    const attempt=++previewSequence.current;
    setPreviewBusy(true);
    setPreview(undefined);
    const candidate={
      eventType:suggestion.eventType,severity:suggestion.severity,
      ...(suggestion.serviceCode?{serviceCode:suggestion.serviceCode}:{}),
    };
    try{
      const raw:unknown=await requestOwnerWorkflowWhatIf({
        workspaceSlug,branchId,candidate,sampleServiceCode:sampleCode,
      });
      if(previewSequence.current!==attempt)return;
      const evidence=parseOwnerWhatIfResponse(raw,{eventType:suggestion.eventType});
      if(!evidence){
        setFeedback("Synthetic preview unavailable or owner/branch authorization changed. Nothing was executed.");
        return;
      }
      setPreview(evidence);
      setFeedback("Synthetic rule-engine preview completed. This did not use a saved event or publish anything.");
    }catch{
      if(previewSequence.current===attempt)
        setFeedback("Synthetic preview unavailable. No saved workflow or customer action changed.");
    }finally{
      if(previewSequence.current===attempt)setPreviewBusy(false);
    }
  }

  const automationsHref=buildStaffModuleHref(workspaceSlug,"automations");
  return <section className={styles.panel}
    aria-label="Owner AI workflow authoring and hypothetical preview"
    data-testid="owner-ai-workflow-authoring">
    <header className={styles.head}>
      <div>
        <p className={styles.eyebrow}>Owner AI workflow builder · manual governance</p>
        <h3>From an idea to a safe internal workflow</h3>
        <p>Describe an internal reminder, inspect the strictly typed AI draft,
          then evaluate a fictional service example with the real rule engine.
          Publishing always happens separately in the owner workflow editor.</p>
      </div>
      <span className={configured ? styles.ready : styles.blocked}>
        {configured ? "Model configured · response unverified" : "Model not enabled"}
      </span>
    </header>
    <div className={styles.step}>
      <span className={styles.stepNumber}>01</span>
      <div className={styles.stepContent}>
        <h4>Owner intent and authorized branch</h4>
        <div className={styles.fields}>
          <label>Saved branch
            <select value={branchId} disabled={!branches.length || busy || previewBusy}
              onChange={event=>{
                if(!branches.some(b=>b.id===event.target.value))return;
                invalidate();setBranchId(event.target.value);
              }}>
              {branches.length===0?<option value="">No verified branch available</option>:null}
              {branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <label>Internal workflow idea (10–240 letters and punctuation)
            <textarea value={instruction} maxLength={240} rows={3}
              onChange={event=>{invalidate();setInstruction(event.target.value);}}
              disabled={busy || previewBusy}
              placeholder="When a quote is accepted create an internal dispatch review task."/>
          </label>
        </div>
        <p className={styles.helper}>No customer details, contact addresses,
          prices, amounts, URLs, secrets or numeric identifiers are accepted
          in this intent. The model may only suggest one internal attention action.</p>
        <div className={styles.actions}>
          <button type="button" onClick={suggest} className={styles.primary}
            disabled={!canGenerate} aria-busy={busy}>
            {busy?"Generating strictly typed draft…":"Suggest internal workflow"}
          </button>
          {busy?<button type="button" onClick={stopWaiting}
            className={styles.secondary}>Stop waiting</button>:null}
        </div>
        {!configured?<p className={styles.warning} role="status">Only an enabled,
          authorized owner AI runtime can generate a draft. The normal workflow
          editor remains available without AI.</p>:null}
        {configured && !safeIntent?<p className={styles.warning} role="status">
          Use a short, plain-language internal workflow idea without customer or
          pricing details.</p>:null}
      </div>
    </div>
    <div className={styles.step}>
      <span className={styles.stepNumber}>02</span>
      <div className={styles.stepContent}>
        <h4>Compiled proposal · review-only</h4>
        {suggestion?<div className={styles.proposal} aria-label="Strictly compiled owner workflow">
          <dl>
            <div><dt>Saved event trigger</dt><dd>{suggestion.eventType.replaceAll("_"," ")}</dd></div>
            <div><dt>Internal action</dt><dd>CREATE ATTENTION · {suggestion.severity}</dd></div>
            <div><dt>Condition</dt><dd>{suggestion.serviceCode
              ? "Service " + suggestion.serviceCode.replaceAll("_"," ")
              : "No service condition"}</dd></div>
            <div><dt>Model</dt><dd>{suggestion.model}</dd></div>
          </dl>
          <p>The candidate is scoped to your saved branch and was strictly
            compiled from model text. <strong>No draft row, live rule or customer
            action was created.</strong></p>
        </div>:<p className={styles.placeholder}>No verified generated proposal.
          An AI response alone is never permission to publish or execute.</p>}
      </div>
    </div>
    <div className={styles.step}>
      <span className={styles.stepNumber}>03</span>
      <div className={styles.stepContent}>
        <h4>What-if evaluation · synthetic only</h4>
        <div className={styles.previewControls}>
          <label>Fictional service condition
            <select value={sampleCode} disabled={!suggestion || previewBusy}
              onChange={event=>{
                const selected=event.target.value;
                if(!["NONE","STANDARD","DEEP","MOVE_OUT"].includes(selected))return;
                previewSequence.current+=1;
                setPreview(undefined);
                setPreviewBusy(false);
                setSampleCode(selected as typeof sampleCode);
              }}>
              <option value="NONE">No service selected</option>
              <option value="STANDARD">Standard cleaning</option>
              <option value="DEEP">Deep cleaning</option>
              <option value="MOVE_OUT">Move-out cleaning</option>
            </select>
          </label>
          <button type="button" className={styles.secondary}
            disabled={!suggestion || previewBusy || busy} onClick={runPreview}>
            {previewBusy?"Evaluating hypothetical event…":"Run synthetic what-if"}
          </button>
        </div>
        {preview?<div className={styles.preview} role="status">
          <strong>{preview.matched
            ? "Synthetic conditions matched" : "Synthetic conditions did not match"}</strong>
          <p>{preview.matched && preview.wouldCreateAttention
            ? "The preview evaluator would plan one internal attention action."
            : "The preview did not plan an internal attention action."}</p>
          <p>Fictional input only · never a saved trigger, automation execution,
            delivery confirmation or billing event.</p>
        </div>:<p className={styles.placeholder}>Run an explicit synthetic evaluation
          to see whether the proposed condition would match fictional input.</p>}
      </div>
    </div>
    <footer className={styles.footer}>
      <p role="status" aria-live="polite">{feedback || "No AI call or workflow execution has occurred in this panel."}</p>
      <Link href={automationsHref}>Open the separately authorized workflow draft editor →</Link>
      <small>Human review, saved-rule preview and owner publication remain separate.
        Model suggestions and synthetic previews never publish rules, send
        WhatsApp/email, confirm bookings or change payments. A browser timeout
        does not guarantee upstream provider cancellation.</small>
    </footer>
  </section>;
}
