"use client";
import {useEffect,useRef,useState} from "react";
import {requestF17SavedVisitQualityReview,type F17QualityResult} from "./f17-visit-quality-action";
export function AiSavedVisitQualityReview({workspaceSlug,visitId}:{workspaceSlug:string;visitId:string}){
 return <ScopedQuality key={workspaceSlug+":"+visitId} slug={workspaceSlug} visitId={visitId}/>;
}
function ScopedQuality({slug,visitId}:{slug:string;visitId:string}){
 const [result,setResult]=useState<Extract<F17QualityResult,{ok:true}>>();
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(false);
 const pending=useRef(false),mounted=useRef(true),serial=useRef(0);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;serial.current++;};},[]);
 async function inspect(){
  if(pending.current)return;
  pending.current=true;setBusy(true);setResult(undefined);setError("");
  const seq=++serial.current;
  try{
   const response=await requestF17SavedVisitQualityReview(slug,visitId);
   if(!mounted.current||seq!==serial.current)return;
   if(!response.ok||response.state!=="SAVED_VISIT_QUALITY_REVIEW"||
      response.humanApprovalRequired!==true||response.photoMediaVerified!==false||
      response.statusMutated!==false||response.reworkScheduled!==false||
      response.messagesSent!==false||response.modelInvoked!==false){
    setError("Saved visit, branch permission, or checklist evidence changed. Reload the job before approving quality.");return;
   }
   setResult(response);
  }catch{if(mounted.current&&seq===serial.current)setError("Saved visit review is unavailable. No job state or customer message changed.");}
  finally{pending.current=false;if(mounted.current&&seq===serial.current)setBusy(false);}
 }
 return <section aria-label="Saved visit quality and rework advisory" data-testid="f17-job-quality-review" style={{border:"1px solid #d3dedb",padding:16,borderRadius:12,marginBlock:16}}>
  <h3>Verified field-quality review</h3>
  <p>Review saved checklist, evidence metadata and incidents. Actual photo objects are <strong>not verified</strong> by this snapshot.</p>
  <button type="button" onClick={()=>void inspect()} disabled={busy} aria-busy={busy}>
   {busy?"Checking authorized visit evidence…":"Review saved job quality"}
  </button>
  {error?<p role="alert">{error}</p>:null}
  {result?<div role="status" aria-live="polite">
   <p>Saved visit revision {result.visitVersion}. Checklist {result.evidence.completedChecklistCount}/{result.evidence.checklistCount}; before evidence records {result.evidence.beforeRecordCount}; after evidence records {result.evidence.afterRecordCount}; incident records {result.evidence.incidentRecordCount}; open quality cases {result.evidence.openQualityCaseCount}.</p>
   <h4>Findings</h4>
   <ul>{result.findings.map(k=><li key={k}>{k.replaceAll("_"," ").toLowerCase()}</li>)}</ul>
   <h4>Manual next steps</h4>
   <ol>{result.manualSteps.map(k=><li key={k}>{k.replaceAll("_"," ").toLowerCase()}</li>)}</ol>
   <p>Staff must verify real media and approve rework from the authoritative job or quality workspace. No completion, rework or customer message was created.</p>
  </div>:null}
 </section>;
}
