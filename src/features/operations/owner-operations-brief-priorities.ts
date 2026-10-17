import type { StaffModule } from "./staff-modules";
import type { VerifiedOwnerBriefFacts } from "./owner-operations-brief-proof";

export type OwnerPriorityKind =
  | "critical-attention" | "invoice-ledger-review" | "quote-validity"
  | "unassigned-visit" | "customer-quote-wait" | "collectible-invoice"
  | "open-request";
export interface OwnerPriorityCard {
  kind: OwnerPriorityKind;
  count: number;
  title: string;
  detail: string;
  module: StaffModule;
}

/**
 * Deterministic review order, not AI-generated urgency.
 * No due dates, customer names, collection permissions or approved actions
 * can be inferred from these seven verified saved-count buckets alone.
 */
export function buildOwnerPriorityCards(
  facts: Readonly<VerifiedOwnerBriefFacts>,
): OwnerPriorityCard[] {
  const rows: OwnerPriorityCard[] = [
    { kind: "critical-attention", count: facts.unresolvedCriticalAttentions,
      title: "Critical attention items", detail: "Review saved unresolved critical alerts.",
      module: "overview" },
    { kind: "invoice-ledger-review", count: facts.invoiceLedgersNeedingReview,
      title: "Invoice ledger checks", detail: "Verify saved invoices needing ledger review.",
      module: "invoices" },
    { kind: "quote-validity", count: facts.quoteValidityNeedsReview,
      title: "Quote validity checks", detail: "Review saved quotes flagged for validity checks.",
      module: "quotes" },
    { kind: "unassigned-visit", count: facts.unassignedActiveVisits,
      title: "Unassigned active visits", detail: "Review saved active visits before assigning crew.",
      module: "jobs" },
    { kind: "customer-quote-wait", count: facts.waitingOnCustomerQuotes,
      title: "Quotes awaiting customers", detail: "Inspect saved quote status; no outreach is authorized.",
      module: "quotes" },
    { kind: "collectible-invoice", count: facts.collectibleInvoices,
      title: "Collectible invoices", detail: "Verify saved invoice and ledger before considering follow-up.",
      module: "invoices" },
    { kind: "open-request", count: facts.openRequests,
      title: "Open requests", detail: "Review persisted service requests requiring manual decisions.",
      module: "requests" },
  ];
  // Only positive verified counts deserve a displayed priority. This is an
  // intentionally limited three-card surface, not a complete workday report.
  return rows.filter(item => item.count > 0).slice(0, 3);
}
