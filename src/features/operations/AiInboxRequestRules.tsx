"use client";
import {useEffect,useRef,useState} from "react";
import {runInboxPublishedRequestRules,type InboxRulesActionResult}
 from "./f19-inbox-request-rules-action";

export function AiInboxRequestRules({workspaceSlug,conversationId}:{
 workspaceSlug:string;conversationId:string;
}){
 return <ScopedRequestRules key={workspaceSlug+":"+conversationId}
   workspaceSlug={workspaceSlug} conversationId={conversationId}/>;
}
function ScopedRequestRules({workspaceSlug,conversationId}:{
 workspaceSlug:string;conversationId:string;
}){
 const [result,setResult]=useState<Extract<InboxRulesActionResult,{ok:true}>>();
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 const pending=useRef(false),mounted=useRef(true),serial=useRef(0);
 useEffect(()=>{const m=mounted,s=serial;m.current=true;
  return()=>{m.current=false;s.current++;};},[]);
 async function execute(){
  if(pending.current)return;
  pending.current=true;setBusy(true);setError("");setResult(undefined);
  const seq=++serial.current;
  try{
   const response=await runInboxPublishedRequestRules(workspaceSlug,conversationId);
   if(!mounted.current||serial.current!==seq)return;
   if(!response.ok||
     !["INTERNAL_ATTENTION_VERIFIED","NO_INTERNAL_ATTENTION_CREATED"].includes(response.state)||
     response.ownerTriggered!==true||response.externalMessagesSent!==0||
     response.customerMessageSent!==false||response.moneyChanged!==false||
     response.automaticSlaEventCreated!==false||
     response.persistedInternalAttentionVerified!==(response.completedAttentionActions>0)){
    setError("Published request rules could not be processed. Check owner permissions, backend configuration and execution history.");
    return;
   }
   setResult(response);
  }catch{
   if(mounted.current&&serial.current===seq)
    setError("Request workflow could not be verified. Inspect saved workflow executions before retrying.");
  }finally{
   pending.current=false;
   if(mounted.current&&serial.current===seq)setBusy(false);
  }
 }
 return <section aria-label="Owner request workflow processing" data-testid="f19-inbox-request-rules"
   style={{border:"1px solid #d3dedb",borderRadius:12,padding:16,marginBlock:14}}>
  <h3>Process published request rules</h3>
  <p>For this saved request, explicitly run existing published <strong>REQUEST_CREATED</strong> rules.
   Matching internal attention actions can be saved and independently verified. This is
   <strong> not an unanswered-lead SLA event</strong> and will not send customer messages.</p>
  <button type="button" disabled={busy} aria-busy={busy} onClick={()=>void execute()}>
   {busy?"Verifying published rules and saved actions…":"Process published request rules"}
  </button>
  {error?<p role="alert">{error}</p>:null}
  {result?<div role="status" aria-live="polite">
   <strong>{result.persistedInternalAttentionVerified?
    "Verified internal attention recorded":"No internal attention created"}</strong>
   <p>Matched workflow executions: {result.matchedRules}. Newly recorded executions:
    {" "}{result.newlyRecordedExecutions}. Idempotent replays: {result.reusedExecutions}.</p>
   <p>Verified saved internal attention actions: {result.completedAttentionActions}.
    External actions requiring separate owner approval: {result.externalApprovalRequired}.</p>
   <p>Zero customer messages sent. This does not create an automatic SLA escalation,
    change billing, assign a crew, or approve external delivery.</p>
  </div>:null}
 </section>;
}
