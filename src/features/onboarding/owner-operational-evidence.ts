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
  "requests" | "quotes" | "visits" | "invoices" | "branchScope" |
  "workflowAvailable" | "workflowExecutions" | "workflowActionExecutions"
>): OwnerOperationalEvidence {
  const branches = input.branchScope;
  // A selected branch must not inherit request, visit or automation successes
  // from another branch in the same workspace. A legacy snapshot that has no
  // verified branch scope remains read-only historical counts.
  const inScope = (branchId?: string) =>
    !branches || branches.mode === "LEGACY" ||
    (typeof branchId === "string" &&
      (branches.mode === "BRANCH"
        ? branchId === branches.selectedBranchId &&
          branches.branches.some(branch => branch.id === branchId)
        : branches.branches.some(branch => branch.id === branchId)));
  const requests = new Map(input.requests
    .filter(request => inScope(request.branchId))
    .map(request => [request.id, request]));
  const requestIds = new Set(requests.keys());
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
    const request = requests.get(visit.requestId);
    return quote?.requestId === visit.requestId &&
      inScope(visit.branchId) &&
      (!request?.branchId || !visit.branchId ||
        request.branchId === visit.branchId);
  });
  const acceptedVisitById = new Map(visits.map(visit => [visit.id, visit]));
  const invoices = input.invoices.filter(invoice => {
    const accepted = typeof invoice.quoteId === "string" &&
      acceptedById.has(invoice.quoteId);
    if (!accepted) return false;
    // A linked invoice cannot borrow an unrelated visit's success.
    if (!invoice.visitId) return true;
    return acceptedVisitById.get(invoice.visitId)?.quoteId === invoice.quoteId;
  });

  let completedInternalAttention: number | null = null;
  if (input.workflowAvailable === true &&
      Array.isArray(input.workflowExecutions) &&
      Array.isArray(input.workflowActionExecutions)) {
    const live = new Map(input.workflowExecutions.filter(execution =>
      inScope(execution.branchId) &&
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
