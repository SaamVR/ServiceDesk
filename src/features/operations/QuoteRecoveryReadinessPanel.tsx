import Link from "next/link";
import {loadOperationalStaffSnapshot} from "./operational-product-runtime";
import {resolveF19QuoteRecoveryTarget} from "./f19-quote-recovery-targets";
import {buildStaffModuleHref} from "./staff-modules";
const labels={
 SOURCE_UNVERIFIED:"Saved quote or snapshot cannot be verified",
 AMBIGUOUS_CURRENT_VERSION:"Conflicting current quote versions",
 HISTORICAL_VERSION:"Historical quote; use the latest saved revision",
 SAVED_CHARGES_UNVERIFIED:"Saved charge breakdown does not reconcile",
 EXPIRED_OR_UNKNOWN_VALIDITY:"Quote validity has expired or cannot be verified",
 STAFF_APPROVAL_REQUIRED:"Staff approval still required",
 READY_FOR_MANUAL_SEND_REVIEW:"Verified preflight; staff must send from the authoritative quote",
 SENT_DELIVERY_UNVERIFIED:"Quote marked sent; delivery receipt not established",
 STATUS_REVIEW_REQUIRED:"Review the current quote status",
} as const;
const advice={
 REFRESH_SAVED_RECORDS:"Refresh the Quotes page and resolve contradictory saved versions before proceeding.",
 OPEN_CURRENT_QUOTE:"Open the currently saved quote, not its historical revision.",
 REVIEW_REQUEST_AND_PRICING:"Open the originating request and confirm the actual active branch price book; do not reuse guessed charges.",
 RENEW_QUOTE:"Recalculate or renew the quote through the owner-approved source workflow, then verify its new validity window.",
 APPROVE_FROM_SOURCE:"An authorized staff member must review and approve the saved quote before sending.",
 VERIFY_SEND_IN_AUTHORITATIVE_QUOTE:"Review contact, consent and source state. Send only using the separate authorized quote command.",
 VERIFY_CUSTOMER_DELIVERY:"Check actual delivery/receipt evidence before treating a SENT database status as received.",
 REVIEW_STATUS:"Inspect the authoritative quote lifecycle and obtain the next permitted staff action.",
} as const;
/** A secondary, source-grounded quote triage panel. It makes no quote
 * transition and does not expose private pricing or customer metadata. */
export async function QuoteRecoveryReadinessPanel({workspaceSlug,selectedQuoteId}:{
 workspaceSlug:string;selectedQuoteId?:string;
}){
 if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(workspaceSlug))return null;
 const result=await loadOperationalStaffSnapshot(workspaceSlug);
 if(!result.ok||result.value.workspace.slug!==workspaceSlug||
    !["OWNER","DISPATCHER"].includes(result.value.actor.role))return null;
 const snapshot=result.value,scope=snapshot.branchScope;
 if(!scope||!["ALL","BRANCH"].includes(scope.mode))return null;
 const allowedBranchIds=new Set(scope.branches.map(x=>x.id));
 // Only a request in the actor's current authorized branch scope can
 // authorize a quote review, even if a previously loaded quote survives.
 const requests=snapshot.requests.filter(req=>
   typeof req.branchId==="string"&&allowedBranchIds.has(req.branchId)&&
   (scope.mode==="ALL"||req.branchId===scope.selectedBranchId));
 const authorized=new Set(requests.map(x=>x.id));
 const quotes=snapshot.quotes.filter(q=>authorized.has(q.requestId));
 if(!quotes.length)return null;
 const quoteHref=buildStaffModuleHref(workspaceSlug,"quotes");
 const selected=selectedQuoteId?quotes.find(q=>q.id===selectedQuoteId):undefined;
 if(!selected)return <section className="app-panel" aria-label="Select saved quote for recovery"
   data-testid="f19-quote-source-recovery">
  <h2>Quote version and source recovery</h2>
  <p>Choose an authorized saved quote to inspect its exact version, request and renewal path. No quote was selected.</p>
  <ul>{quotes.slice(0,25).map((q,i)=><li key={q.id}>
    <Link href={quoteHref+"?quote="+encodeURIComponent(q.id)}>
     Quote {i+1} · revision {q.version} · {q.status.replaceAll("_"," ").toLowerCase()}</Link>
  </li>)}</ul>
  <p>Only the first 25 authorized quote records are shown in this additional review list.</p>
 </section>;
 const plan=resolveF19QuoteRecoveryTarget({
   slug:workspaceSlug,selectedId:selected.id,
   quotes,requests,loadedAt:snapshot.loadedAt,
 });
 if(!plan)return <section className="app-panel" role="alert"
   aria-label="Saved quote recovery unavailable">
  <p>Quote/request authority or saved version could not be reconciled.
   Reload the authorized Quotes page before taking action.</p>
 </section>;
 const outcome=plan.guidance;
 return <section className="app-panel" aria-label="Saved quote recovery guidance"
  data-testid="f17-quote-recovery-panel">
  <h2>Quote readiness and exact-record recovery</h2>
  <p>Selected quote revision {selected.version} · read-only source proof. No delivery, renewal or charge can be initiated here.</p>
  <p role="status"><strong>{labels[outcome.reason]}</strong></p>
  <p>{advice[outcome.action]}</p>
  <div>
   <Link href={plan.sourceRequestHref}>Open originating saved request</Link>
   {plan.currentQuoteHref ? <p><Link href={plan.currentQuoteHref}>
    Open exact current saved quote revision</Link></p>:
    <p role="alert">Current quote revision is ambiguous or unavailable. Refresh and resolve competing versions before sending.</p>}
   {outcome.action==="REVIEW_REQUEST_AND_PRICING"||outcome.action==="RENEW_QUOTE"?
     <p><Link href={plan.pricingHref}>Review owner branch pricing before renewal</Link></p>:null}
  </div>
  <p>Recalculate, approve or send only using separate authorized, version-checked business commands. No quote was issued, renewed, sent or charged.</p>
 </section>;
}
