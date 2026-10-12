import type {
  OperationalStaffSnapshot,
} from "@/features/operations/operational-product-runtime";

export interface OwnerOperationalEvidence {
  savedRequests: number;
  sentQuotes: number;
  acceptedQuotes: number;
  recordedVisits: number;
  savedInvoices: number;
  completedInternalAttention: number | null;
}

/**
 * A snapshot-evidence inventory, NOT a live provider health test or a proof
 * of one complete customer end-to-end acceptance. Counts may be limited to
 * records included in the already authorized owner/branch snapshot.
 *
 * Never count a preview/synthetic action as a real internal automation.
 */
export function summarizeOwnerOperationalEvidence(input: Pick<
  OperationalStaffSnapshot,
  "requests" | "quotes" | "visits" | "invoices" |
  "workflowAvailable" | "workflowExecutions" | "workflowActionExecutions"
>): OwnerOperationalEvidence {
  const requestIds = new Set(input.requests.map(request => request.id));
  const quoteRows = input.quotes.filter(quote =>
    requestIds.has(quote.requestId) &&
    Number.isSafeInteger(quote.totalMinor) &&
    quote.totalMinor >= 0 &&
    typeof quote.currency === "string" &&
    /^[A-Z]{3}$/.test(quote.currency));
  const sentQuotes = quoteRows.filter(quote =>
    quote.status === "SENT" || quote.status === "ACCEPTED");
  const accepted = sentQuotes.filter(quote => quote.status === "ACCEPTED");
  const acceptedById = new Map(accepted.map(quote => [quote.id, quote]));
  const visits = input.visits.filter(visit => {
    const quote = acceptedById.get(visit.quoteId);
    return quote?.requestId === visit.requestId;
  });
  const invoices = input.invoices.filter(invoice =>
    typeof invoice.quoteId === "string" &&
    acceptedById.has(invoice.quoteId));

  let completedInternalAttention: number | null = null;
  if (input.workflowAvailable === true &&
      Array.isArray(input.workflowExecutions) &&
      Array.isArray(input.workflowActionExecutions)) {
    const live = new Map(input.workflowExecutions.filter(execution =>
      execution.mode === "LIVE" &&
      execution.eventType === "QUOTE_ACCEPTED" &&
      execution.matched === true &&
      execution.state === "COMPLETED")
      .map(execution => [execution.id, execution]));
    const successes = new Set(input.workflowActionExecutions
      .filter(action => {
        const execution = live.get(action.executionId);
        return execution &&
          action.branchId === execution.branchId &&
          action.actionType === "CREATE_ATTENTION" &&
          action.state === "SUCCEEDED";
      })
      .map(action => action.executionId));
    completedInternalAttention = successes.size;
  }

  return {
    savedRequests: requestIds.size,
    sentQuotes: sentQuotes.length,
    acceptedQuotes: accepted.length,
    recordedVisits: visits.length,
    savedInvoices: invoices.length,
    completedInternalAttention,
  };
}
