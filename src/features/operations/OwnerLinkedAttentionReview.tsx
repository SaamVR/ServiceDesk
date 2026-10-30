"use client";
import {useEffect,useRef,useState} from "react";
import {requestF15LinkedAttentionProof} from "./f15-owner-linked-attention-action";
import type {F15AttentionProof} from "@/server/workflows/sonic-f15-owner-linked-attention";
export function OwnerLinkedAttentionReview({workspaceSlug,branchId,requestId}:{
 workspaceSlug:string;branchId:string;requestId:string;
}){
 return <ScopedAttention key={workspaceSlug+":"+branchId+":"+requestId}
  slug={workspaceSlug} branchId={branchId} requestId={requestId}/>;
}
function ScopedAttention({slug,branchId,requestId}:{
 slug:string;branchId:string;requestId:string;
}){
 const [proof,setProof]=useState<F15AttentionProof|null>(null);
 const [busy,setBusy]=useState(false),mounted=useRef(true),
   pending=useRef(false),serial=useRef(0);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;serial.current++;};},[]);
 async function check(){
  if(pending.current)return;
  pending.current=true;setBusy(true);setProof(null);
  const seq=++serial.current;
  try{
   const read=await requestF15LinkedAttentionProof(slug,branchId,requestId);
   if(mounted.current&&seq===serial.current)setProof(read);
  }catch{if(mounted.current&&seq===serial.current)setProof({state:"UNAVAILABLE"});}
  finally{pending.current=false;if(mounted.current&&seq===serial.current)setBusy(false);}
 }
 return <section aria-label="Saved F15 internal attention proof"
   data-testid="f15-owner-saved-attention-proof">
  <h3>Verify internal Attention Center outcome</h3>
  <p>Independently verify that each saved overdue-lead review has one linked
    owner attention item. This is not a provider delivery or rule-execution receipt.</p>
  <button type="button" onClick={()=>void check()} disabled={busy} aria-busy={busy}>
   {busy?"Checking linked saved records…":"Verify saved internal attention"}
  </button>
  {proof?.state==="LINKED_INTERNAL_ATTENTION_VERIFIED"?
    <p role="status">Verified {proof.count} linked owner-attention item(s):
      {proof.open} open, {proof.acknowledged} acknowledged,
      {proof.resolved} resolved. Review still requires human action;
      no external message or rule execution was performed.</p>:
    proof?.state==="NO_REVIEW_RECORDED"?
      <p role="status">No saved F15 review exists for this selected request.</p>:
    proof?.state==="UNAVAILABLE"?
      <p role="alert">Linked attention cannot be verified. V3 may be unapplied,
        incomplete, or inaccessible. No outcome is claimed.</p>:null}
 </section>;
}
