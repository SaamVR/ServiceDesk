import Link from "next/link";
import {loadOperationalStaffSnapshot} from "./operational-product-runtime";
import {guideSavedQuoteRecovery} from "./f17-quote-recovery-guide";
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
 const snapshot=result.value;
 const allowed=new Set(snapshot.requests.map(r=>r.id));
 const quotes=snapshot.quotes.filter(q=>allowed.has(q.requestId));
 if(!quotes.length)return null;
 const selected=quotes.find(q=>q.id===selectedQuoteId)??quotes[0];
 const outcome=guideSavedQuoteRecovery(quotes,selected.id,snapshot.loadedAt);
 const quoteHref=buildStaffModuleHref(workspaceSlug,"quotes");
 const href=outcome.action==="REVIEW_REQUEST_AND_PRICING"
  ? buildStaffModuleHref(workspaceSlug,"settings")+"?section=services"
  : outcome.action==="OPEN_CURRENT_QUOTE"||outcome.action==="REFRESH_SAVED_RECORDS"
    ? quoteHref
    : quoteHref+"?quote="+encodeURIComponent(selected.id);
 return <section className="app-panel" aria-label="Saved quote recovery guidance"
  data-testid="f17-quote-recovery-panel">
  <h2>Quote readiness and recovery</h2>
  <p>Saved-row, version and charge checks only. This is not an invoice, customer delivery proof or permission to send.</p>
  <p><strong>{labels[outcome.reason]}</strong></p>
  <p>{advice[outcome.action]}</p>
  <Link href={href}>Open authoritative source or recovery step</Link>
  <p>No quote was issued, renewed, sent or charged. Fresh authorization and concurrency checks remain mandatory for any business action.</p>
 </section>;
}
