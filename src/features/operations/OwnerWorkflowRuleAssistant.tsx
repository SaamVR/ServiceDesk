"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { buildStaffModuleHref } from "./staff-modules";
import {
  validateOwnerRuleIntent, parseOwnerWorkflowSuggestion,
  parseOwnerWhatIfResponse, parseOwnerWhatIfMatrix, type VerifiedOwnerWhatIfMatrix,
  type VerifiedOwnerRuleSuggestion,
  type VerifiedOwnerWhatIf, type SuggestedServiceCode,
} from "./owner-rule-browser-proof";
import { requestOwnerWorkflowWhatIf, requestOwnerWorkflowWhatIfMatrix } from "./owner-rule-whatif-action";
import { saveOwnerReviewedWorkflowDraft } from "./owner-rule-save-action";
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
  const [saving,setSaving]=useState(false);
  const [reviewConfirmed,setReviewConfirmed]=useState(false);
  const [draftSaved,setDraftSaved]=useState(false);
  const [ruleCode,setRuleCode]=useState("");
  const [ruleName,setRuleName]=useState("");
  const [feedback,setFeedback]=useState("");
  const [suggestion,setSuggestion]=useState<VerifiedOwnerRuleSuggestion>();
  const [preview,setPreview]=useState<VerifiedOwnerWhatIf>();
  const [comparison,setComparison]=useState<VerifiedOwnerWhatIfMatrix>();
  const [sampleCode,setSampleCode]=useState<"NONE"|SuggestedServiceCode>("STANDARD");
  const activeRequest=useRef<AbortController|null>(null);
  const sequence=useRef(0);
  const previewSequence=useRef(0);
  const saveSequence=useRef(0);
  // State updates are asynchronous: refs prevent rapid duplicate user clicks
  // from sending multiple paid model calls, read requests or durable drafts.
  const modelPending=useRef(false);
  const previewPending=useRef(false);
  const savePending=useRef(false);

  useEffect(()=>()=> {
    activeRequest.current?.abort();
    activeRequest.current=null;
    sequence.current+=1;
    previewSequence.current+=1;
    saveSequence.current+=1;
    modelPending.current=false;
    previewPending.current=false;
    savePending.current=false;
  },[]);

  function invalidate() {
    activeRequest.current?.abort();
    activeRequest.current=null;
    sequence.current+=1;
    previewSequence.current+=1;
    saveSequence.current+=1;
    modelPending.current=false;
    previewPending.current=false;
    savePending.current=false;
    setReviewConfirmed(false);
    setDraftSaved(false);
    setRuleCode("");
    setRuleName("");
    setSaving(false);
    setBusy(false);
    setPreviewBusy(false);
    setSuggestion(undefined);
    setPreview(undefined);
    setComparison(undefined);
    setFeedback("");
  }
  const safeIntent=validateOwnerRuleIntent(instruction);
  const canGenerate=configured && Boolean(safeIntent) && Boolean(branchId) &&
    !busy && !previewBusy && !saving;

  async function suggest() {
    if(modelPending.current || !canGenerate || !safeIntent) return;
    invalidate();
    modelPending.current=true;
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
        modelPending.current=false;
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
      setRuleCode("AI_" + parsed.eventType + "_REVIEW");
      setRuleName("AI suggested " + parsed.eventType.replaceAll("_"," ").toLowerCase() + " attention");
      setFeedback("Typed internal-attention draft compiled for owner review. Not saved or published.");
    }catch{
      if(!controller.signal.aborted && activeRequest.current===controller)
        setFeedback("No verified model suggestion was returned. No workflow was created.");
    }finally{
      clearTimeout(timer);
      if(activeRequest.current===controller){
        activeRequest.current=null;
        modelPending.current=false;
        setBusy(false);
      }
    }
  }

  function stopWaiting(){
    if(!activeRequest.current)return;
    const controller=activeRequest.current;
    activeRequest.current=null;
    sequence.current+=1;
    modelPending.current=false;
    controller.abort();
    setBusy(false);
    setFeedback("Stopped this browser request. The model may still finish upstream; no rule was saved or published from this interface.");
  }

  async function runPreview(){
    if(previewPending.current || !suggestion || previewBusy || busy ||
       saving || draftSaved || suggestion.branchId!==branchId)return;
    previewPending.current=true;
    const attempt=++previewSequence.current;
    setPreviewBusy(true);
    setPreview(undefined);
    setComparison(undefined);
    setReviewConfirmed(false);
    const candidate={
      eventType:suggestion.eventType,severity:suggestion.severity,
      ...(suggestion.serviceCode?{serviceCode:suggestion.serviceCode}:{}),
    };
    try{
      const raw:unknown=await requestOwnerWorkflowWhatIf({
        workspaceSlug,branchId,candidate,
        sampleServiceCode:suggestion.serviceCode ? sampleCode : "NONE",
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
      previewPending.current=false;
    }
  }

  async function compareSamples(){
    if(previewPending.current || !suggestion?.serviceCode || previewBusy ||
       busy || saving || draftSaved || suggestion.branchId!==branchId)return;
    previewPending.current=true;
    const attempt=++previewSequence.current;
    setPreviewBusy(true);
    setReviewConfirmed(false);
    setPreview(undefined);
    setComparison(undefined);
    setFeedback("Comparing three fictional service scenarios using the protected preview evaluator…");
    try{
      const raw:unknown=await requestOwnerWorkflowWhatIfMatrix({
        workspaceSlug,branchId,candidate:{
          eventType:suggestion.eventType,severity:suggestion.severity,
          serviceCode:suggestion.serviceCode,
        },
      });
      if(previewSequence.current!==attempt)return;
      const result=parseOwnerWhatIfMatrix(raw);
      if(!result){
        setFeedback("Synthetic comparison could not be verified. No live rule or event changed.");
        return;
      }
      setComparison(result);
      setFeedback("Compared three fictional services. Results cannot prove real operational outcomes.");
    }catch{
      if(previewSequence.current===attempt)
        setFeedback("Hypothetical comparisons unavailable. No automation was executed.");
    }finally{
      if(previewSequence.current===attempt)setPreviewBusy(false);
      previewPending.current=false;
    }
  }

  async function saveDraft(){
    if(savePending.current || !suggestion || !preview || !reviewConfirmed ||
       busy || previewBusy || saving || draftSaved ||
       suggestion.branchId!==branchId ||
       !/^[A-Z0-9][A-Z0-9_-]{2,63}$/.test(ruleCode) ||
       ruleName.trim().length<5 || ruleName.length>120)return;
    savePending.current=true;
    const current=++saveSequence.current;
    setSaving(true);
    setFeedback("Saving a reviewed internal-only draft; nothing is being published.");
    try{
      const candidate={eventType:suggestion.eventType,severity:suggestion.severity,
        ...(suggestion.serviceCode?{serviceCode:suggestion.serviceCode}:{})};
      const response=await saveOwnerReviewedWorkflowDraft({
        workspaceSlug,branchId,candidate,code:ruleCode,name:ruleName.trim(),
      });
      if(saveSequence.current!==current)return;
      if(!response.ok || response.state!=="DRAFT_SAVED_OWNER_PREVIEW_REQUIRED" ||
         response.published!==false || response.executed!==false){
        setFeedback("Draft not saved. Verify owner permissions, branch and unique rule code. No rule was published.");
        return;
      }
      setDraftSaved(true);
      setFeedback("Draft saved in ServiceDesk. Review its saved version and run the separate saved-rule preview before manually publishing.");
    }catch{
      if(saveSequence.current===current)
        setFeedback("Save result is uncertain. Inspect saved workflow versions before retrying to avoid duplicate drafts.");
    }finally{
      if(saveSequence.current===current)setSaving(false);
      savePending.current=false;
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
            <select value={branchId} disabled={!branches.length || busy || previewBusy || saving}
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
              disabled={busy || previewBusy || saving}
              placeholder="When a quote is accepted create an internal dispatch review task."/>
          </label>
        </div>
        <p className={styles.helper}>Use generic workflow intentions only:
          never enter customer names, private service notes or secrets. The
          form blocks common contacts, numbers, prices and link formats but
          cannot reliably recognize every private name or sensitive phrase.
          The model may only suggest one internal attention action.</p>
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
            <select value={suggestion?.serviceCode ? sampleCode : "NONE"}
              disabled={!suggestion?.serviceCode || previewBusy}
              onChange={event=>{
                const selected=event.target.value;
                if(!["NONE","STANDARD","DEEP","MOVE_OUT"].includes(selected))return;
                previewSequence.current+=1;
                setReviewConfirmed(false);
                setPreview(undefined);
                setComparison(undefined);
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
            disabled={!suggestion || previewBusy || busy || saving || draftSaved} onClick={runPreview}>
            {previewBusy?"Evaluating hypothetical event…":"Run synthetic what-if"}
          </button>
          {suggestion?.serviceCode?<button type="button" className={styles.secondary}
            disabled={previewBusy || busy || saving || draftSaved} onClick={compareSamples}>
            Compare Standard / Deep / Move-out
          </button>:null}
        </div>
        {suggestion && !suggestion.serviceCode ? <p className={styles.helper} role="note">
          This proposal has no service condition. The hypothetical service
          selector is disabled because it cannot change the rule decision.
        </p> : null}
        {comparison?<section className={styles.comparison}
          aria-label="Fictional service comparison" role="status">
          <h5>Three hypothetical outcomes · no saved event</h5>
          <div className={styles.comparisonGrid}>
            {comparison.results.map(result=><div key={result.serviceCode}>
              <strong>{result.serviceCode.replaceAll("_"," ")}</strong>
              <span>{result.matched ?
                result.wouldCreateAttention ? "Would propose an internal attention" :
                  "Condition matched; no action proposed" :
                "Conditions did not match"}</span>
            </div>)}
          </div>
          <p>Each scenario used the authorized read-only rule evaluator.
            These are not actual customers, bookings, invoices, provider sends
            or workflow executions. Run an individual what-if and review
            the exact rule before you can save a draft.</p>
        </section>:null}
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
    <div className={styles.step}>
      <span className={styles.stepNumber}>04</span>
      <div className={styles.stepContent}>
        <h4>Persist an owner-reviewed draft · never auto-publish</h4>
        <p className={styles.helper}>After a hypothetical preview, the owner may
          explicitly save one internal-attention DRAFT through the existing
          authorized workflow writer. No publishing, sending or execution occurs.
          Recheck the saved draft in Workflow builder before publishing manually.</p>
        <div className={styles.fields}>
          <label>Unique rule code
            <input type="text" value={ruleCode} maxLength={64}
              disabled={!preview || saving || draftSaved}
              onChange={event=>{setRuleCode(event.target.value.toUpperCase());setReviewConfirmed(false);}}
              pattern="[A-Z0-9][A-Z0-9_-]{2,63}" required/>
          </label>
          <label>Human-reviewed rule name
            <input type="text" value={ruleName} maxLength={120}
              disabled={!preview || saving || draftSaved}
              onChange={event=>{setRuleName(event.target.value);setReviewConfirmed(false);}}
              required/>
          </label>
          <label className={styles.reviewControl}>
            <input type="checkbox" checked={reviewConfirmed} disabled={!preview || saving || draftSaved}
              onChange={event=>setReviewConfirmed(event.target.checked)}/>
            I reviewed the exact compiled rule and understand that saving
            a draft does not publish or execute an automation.
          </label>
        </div>
        <button type="button" className={styles.primary} onClick={saveDraft}
          disabled={!preview || !reviewConfirmed || saving || draftSaved ||
            !/^[A-Z0-9][A-Z0-9_-]{2,63}$/.test(ruleCode) ||
            ruleName.trim().length<5 || ruleName.length>120}
          aria-busy={saving}>
          {saving ? "Saving reviewed draft…" :
            draftSaved ? "Draft saved — inspect workflow" : "Save reviewed rule DRAFT"}
        </button>
        {draftSaved?<p className={styles.proposal} role="status">
          Saved draft acknowledged by the authorized writer.
          <Link href={automationsHref}>Open the saved workflow builder →</Link>
          Run the saved version preview and publish separately if approved.
          No workflow event or customer delivery was executed.
        </p>:null}
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
