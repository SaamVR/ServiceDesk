import { indexAmbiguousCurrentQuoteRequests, indexCurrentQuoteByRequest } from "./staff-snapshot-index";
import type {
  OperationalInvoice, OperationalQuote, OperationalRequest, OperationalVisit,
} from "./operational-product-runtime";

export type LifecycleStatus =
  | "RECORDED" | "READY_FOR_STAFF" | "AWAITING_CUSTOMER"
  | "ACCEPTED" | "IN_PROGRESS" | "COMPLETED"
  | "NOT_OBSERVED" | "REVIEW_REQUIRED";
export type LifecycleModule = "requests" | "quotes" | "jobs" | "invoices";
export type LifecycleStep = {
  id: "request" | "quote" | "job" | "invoice";
  label: string;
  status: LifecycleStatus;
  detail: string;
  module: LifecycleModule;
  /** Only a verified linked record can form a direct navigation target. */
  recordId?: string;
};

export interface SavedRequestLifecycle {
  /** This display is source-backed, not permission to perform a business action. */
  steps: readonly [LifecycleStep, LifecycleStep, LifecycleStep, LifecycleStep];
  disclosure: string;
}

/**
 * A safe request-specific evidence trace over ALREADY tenant-scoped snapshot rows.
 *
 * - Never match an invoice directly by request ID: it belongs to a quote.
 * - A job must match BOTH requestId and the unambiguous current quoteId.
 * - Duplicate current quote versions block downstream conclusions.
 * - Absence means "not observed in the loaded snapshot", not absent from DB.
 * - No customer send, acceptance, cash movement or provider proof is inferred.
 */
export function summarizeSavedRequestLifecycle(input: {
  request: OperationalRequest;
  quotes: readonly OperationalQuote[];
  visits: readonly OperationalVisit[];
  invoices: readonly OperationalInvoice[];
}): SavedRequestLifecycle {
  const { request } = input;
  const relevantQuotes = input.quotes.filter(quote => quote.requestId === request.id);
  const current = indexCurrentQuoteByRequest(relevantQuotes).get(request.id);
  const conflict = indexAmbiguousCurrentQuoteRequests(relevantQuotes).has(request.id);
  const requestStep: LifecycleStep = {
    id: "request", label: "Customer request", status: "RECORDED", module: "requests",
    recordId: request.id,
    detail: "Saved request · " + request.status.replaceAll("_", " ").toLowerCase() +
      ". Intake details still require staff verification.",
  };
  let quoteStep: LifecycleStep;
  if (conflict) {
    quoteStep = { id: "quote", label: "Staff-reviewed quote", module: "quotes",
      status: "REVIEW_REQUIRED", detail: "Multiple current offers share the highest version. Review quote history; no offer is assumed authoritative." };
  } else if (!current) {
    quoteStep = { id: "quote", label: "Staff-reviewed quote", module: "quotes",
      status: "NOT_OBSERVED", detail: "No current non-superseded quote appears in this loaded snapshot. Review pricing and request details before calculating." };
  } else {
    const status = current.status;
    const evidence: LifecycleStatus = status === "ACCEPTED" ? "ACCEPTED"
      : status === "SENT" ? "AWAITING_CUSTOMER"
      : status === "APPROVED" || status === "DRAFT" ? "READY_FOR_STAFF"
      : "REVIEW_REQUIRED";
    const notes: Record<string, string> = {
      DRAFT: "Saved draft; staff must review and approve.",
      APPROVED: "Staff approved; a database status does not prove customer delivery.",
      SENT: "Marked sent; provider delivery and customer acceptance are not inferred.",
      ACCEPTED: "Saved quote is accepted. Review scheduling separately.",
      DECLINED: "Customer declined this saved quote.",
      EXPIRED: "Saved quote expired; it must not be used as an active customer offer.",
    };
    quoteStep = {
      id: "quote", label: "Staff-reviewed quote", module: "quotes",
      status: evidence, recordId: current.id,
      detail: notes[status] ?? "Saved quote status: " + status.replaceAll("_", " ").toLowerCase() + ".",
    };
  }

  let jobStep: LifecycleStep = {
    id: "job", label: "Scheduled service", module: "jobs", status: "NOT_OBSERVED",
    detail: "No verified job linked to the current quote appears in this loaded snapshot.",
  };
  if (current && !conflict) {
    const linked = input.visits.filter(visit =>
      visit.requestId === request.id && visit.quoteId === current.id);
    if (linked.length > 1) {
      jobStep = { id: "job", label: "Scheduled service", module: "jobs",
        status: "REVIEW_REQUIRED",
        detail: linked.length + " jobs reference the current request and quote. Review scheduling; no single job is assumed." };
    } else if (linked.length === 1) {
      const visit = linked[0];
      jobStep = {
        id: "job", label: "Scheduled service", module: "jobs", recordId: visit.id,
        status: visit.status === "COMPLETED" ? "COMPLETED"
          : visit.status === "CANCELLED" ? "REVIEW_REQUIRED"
          : ["EN_ROUTE", "IN_PROGRESS"].includes(visit.status) ? "IN_PROGRESS"
          : "RECORDED",
        detail: "Saved linked visit · " + visit.status.replaceAll("_", " ").toLowerCase() +
          ". Scheduling and checklist evidence are verified in Jobs.",
      };
    }
  }

  let invoiceStep: LifecycleStep = {
    id: "invoice", label: "Invoice and collection", module: "invoices",
    status: "NOT_OBSERVED",
    detail: "No invoice for the current quote appears in this loaded snapshot. No payment or reminder is inferred.",
  };
  if (current && !conflict) {
    const linked = input.invoices.filter(invoice => invoice.quoteId === current.id);
    if (linked.length > 1) {
      invoiceStep = {
        id: "invoice", label: "Invoice and collection", module: "invoices",
        status: "REVIEW_REQUIRED",
        detail: linked.length + " invoices reference the current quote. Review the invoice ledger; totals and payment state are not inferred.",
      };
    } else if (linked.length === 1) {
      const invoice = linked[0];
      invoiceStep = {
        id: "invoice", label: "Invoice and collection", module: "invoices",
        recordId: invoice.id,
        status: invoice.status === "PAID" ? "COMPLETED"
          : ["VOID", "CANCELLED"].includes(invoice.status) ? "REVIEW_REQUIRED"
          : "RECORDED",
        detail: "Saved linked invoice · " + invoice.status.replaceAll("_", " ").toLowerCase() +
          ". A paid status is ledger state; payment-provider settlement needs separate proof.",
      };
    }
  }
  return {
    steps: [requestStep, quoteStep, jobStep, invoiceStep],
    disclosure: "Only records loaded in this authorized workspace view are shown. A missing stage is not proof that no record exists. Quote sending, customer acceptance, automation execution and payment-provider delivery require separate evidence.",
  };
}
