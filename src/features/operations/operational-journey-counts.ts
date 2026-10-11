import type { OperationalStaffSnapshot } from "./operational-product-runtime";
import { buildInboxTriage } from "./inbox-triage";
import { summarizeOutstandingInvoices } from "./product-truth";

export type OperationalJourneyModule = "inbox" | "requests" | "quotes" | "schedule" | "jobs" | "invoices";
export type OperationalJourneyCounts = Record<OperationalJourneyModule, number>;

/**
 * Only count actual tenant-authorized snapshot records; never synthesize
 * unread badges, live-provider statuses, or quote revenue.
 */
export function operationalJourneyCounts(snapshot: Pick<OperationalStaffSnapshot,
  "conversations" | "messages" | "customers" | "requests" | "quotes" | "visits" | "invoices"
>): OperationalJourneyCounts {
  const inbox = buildInboxTriage(snapshot.conversations, snapshot.messages, snapshot.customers, "all");
  return {
    inbox: inbox.counts["needs-reply"],
    requests: snapshot.requests.filter((request) =>
      ["NEW", "COLLECTING", "READY", "NEEDS_REVIEW"].includes(request.status)).length,
    quotes: snapshot.quotes.filter((quote) => quote.status === "APPROVED").length,
    schedule: snapshot.visits.filter((visit) =>
      !visit.crewId && !["COMPLETED", "CANCELLED"].includes(visit.status)).length,
    jobs: snapshot.visits.filter((visit) =>
      ["IN_PROGRESS", "EN_ROUTE"].includes(visit.status)).length,
    invoices: summarizeOutstandingInvoices(snapshot.invoices.filter((invoice) => Boolean(invoice.quoteId))).count,
  };
}
