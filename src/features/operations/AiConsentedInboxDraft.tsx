"use client";
import {useEffect,useRef,useState} from "react";
import {requestF18ConsentedReplyDraft,type F18InboxDraft} from "./f18-consented-reply-action";
export function AiConsentedInboxDraft({workspaceSlug,conversationId}:{
 workspaceSlug:string;conversationId:string;
}){
 return <ScopedDraft key={workspaceSlug+":"+conversationId}
  workspaceSlug={workspaceSlug} conversationId={conversationId}/>;
}
function ScopedDraft({workspaceSlug,conversationId}:{workspaceSlug:string;conversationId:string}){
 const [value,setValue]=useState<Extract<F18InboxDraft,{ok:true}>>();
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(false),pending=useRef(false),mounted=useRef(true),serial=useRef(0);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;serial.current++;};},[]);
 async function prepare(){
  if(pending.current)return;
  pending.current=true;setBusy(true);setValue(undefined);setError("");
  const seq=++serial.current;
  try{
   const r=await requestF18ConsentedReplyDraft(workspaceSlug,conversationId);
   if(!mounted.current||serial.current!==seq)return;
   if(!r.ok||r.state!=="CONSENTED_DRAFT_REVIEW_ONLY"||
      r.staffApprovalRequired!==true||r.sendTimeConsentRecheckRequired!==true||
      r.sourceHistoryComplete!==false||r.messageSent!==false||r.saved!==false||
      r.providerInvoked!==false||r.modelInvoked!==false){
    setError("Saved owner, recipient, consent or thread evidence is unavailable or changed. Check the inbox before replying.");return;
   }
   setValue(r);
  }catch{if(mounted.current&&serial.current===seq)setError("Review draft unavailable; no message was queued or sent.");}
  finally{pending.current=false;if(mounted.current&&serial.current===seq)setBusy(false);}
 }
 return <section aria-label="Consent-checked owner reply draft" data-testid="f18-consented-inbox-draft"
   style={{border:"1px solid #d3dedb",borderRadius:12,padding:16,marginBlock:14}}>
  <h3>Saved-thread reply draft · owner review</h3>
  <p>Checks saved recipient, channel consent and thread version twice. No model connection needed.</p>
  <button type="button" onClick={()=>void prepare()} disabled={busy} aria-busy={busy}>
   {busy?"Rechecking saved thread and consent…":"Prepare review-only reply draft"}
  </button>
  {error?<p role="alert">{error}</p>:null}
  {value?<div role="status" aria-live="polite">
   <p>Channel: {value.channel} · saved conversation revision {value.conversationVersion}</p>
   <blockquote>{value.draftText}</blockquote>
   <p>Draft only. It has not been saved or sent. Confirm the recipient, latest consent, opt-out and quiet hours again before any separate human-approved delivery.</p>
  </div>:null}
 </section>;
}
