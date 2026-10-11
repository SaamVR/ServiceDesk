import { indexCurrentQuoteByRequest } from "./staff-snapshot-index";

export interface QuotePipelineRecord {
  id: string;
  requestId: string;
  status: string;
  version: number;
}

/**
 * Workday-first quote ordering and counts from already-authorized snapshot rows.
 * A superseded or older record is visible as history, never a live send target.
 * No quote mutations or external delivery decisions occur here.
 */
export function buildQuotePipeline<T extends QuotePipelineRecord>(quotes: readonly T[]) {
  const currentQuoteByRequest = indexCurrentQuoteByRequest(quotes);
  const statusPriority: Record<string, number> = {
    APPROVED: 0, SENT: 1, ACCEPTED: 2, DRAFT: 3,
    EXPIRED: 4, DECLINED: 5, SUPERSEDED: 6,
  };
  const orderedQuotes = [...quotes].sort((left, right) => {
    const leftCurrent = currentQuoteByRequest.get(left.requestId)?.id === left.id;
    const rightCurrent = currentQuoteByRequest.get(right.requestId)?.id === right.id;
    return Number(rightCurrent) - Number(leftCurrent)
      || (statusPriority[left.status] ?? 9) - (statusPriority[right.status] ?? 9)
      || right.version - left.version
      || left.id.localeCompare(right.id);
  });
  const currentQuotes = [...currentQuoteByRequest.values()];
  return {
    currentQuoteByRequest,
    orderedQuotes,
    awaitingCustomer: currentQuotes.filter((quote) => quote.status === "SENT").length,
    readyToSend: currentQuotes.filter((quote) => quote.status === "APPROVED").length,
  };
}

export function isCurrentApprovedQuote<T extends QuotePipelineRecord>(
  quote: T,
  currentQuoteByRequest: ReadonlyMap<string, T>,
): boolean {
  return quote.status === "APPROVED" && currentQuoteByRequest.get(quote.requestId)?.id === quote.id;
}
