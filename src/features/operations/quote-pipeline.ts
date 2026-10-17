import { indexAmbiguousCurrentQuoteRequests, indexCurrentQuoteByRequest } from "./staff-snapshot-index";

export interface QuotePipelineRecord {
  id: string;
  requestId: string;
  status: string;
  version: number;
  validUntil?: string;
}

/** A SENT database status does not establish that the customer can still
 * accept the quote. Invalid or elapsed deadlines require staff review, not
 * a fabricated response or an automatic status mutation. */
function quoteValidityUnverified(quote: QuotePipelineRecord, snapshotAt: string): boolean {
  const now = Date.parse(snapshotAt);
  const expires = typeof quote.validUntil === "string"
    ? Date.parse(quote.validUntil) : NaN;
  // An invalid snapshot clock cannot establish expiry or freshness.
  // The aggregate queue separately fails closed on clock uncertainty.
  return Number.isFinite(now) && (!Number.isFinite(expires) || expires <= now);
}

export function needsSentQuoteExpiryReview(quote: QuotePipelineRecord, snapshotAt: string): boolean {
  return quote.status === "SENT" && quoteValidityUnverified(quote, snapshotAt);
}

export function needsApprovedQuoteExpiryReview(quote: QuotePipelineRecord, snapshotAt: string): boolean {
  return quote.status === "APPROVED" && quoteValidityUnverified(quote, snapshotAt);
}

/**
 * Workday-first quote ordering and counts from already-authorized snapshot rows.
 * A superseded or older record is visible as history, never a live send target.
 * No quote mutations or external delivery decisions occur here.
 */
export function buildQuotePipeline<T extends QuotePipelineRecord>(
  quotes: readonly T[], snapshotAt?: string,
) {
  const currentQuoteByRequest = indexCurrentQuoteByRequest(quotes);
  const ambiguousCurrentQuoteRequests = indexAmbiguousCurrentQuoteRequests(quotes);
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
  const clockValid = snapshotAt === undefined || (snapshotAt.trim().length > 0 && Number.isFinite(Date.parse(snapshotAt)));
  return {
    currentQuoteByRequest,
    orderedQuotes,
    // These requests must be manually reconciled before any quote is treated
    // as current/approved/sent, even when both rows look unexpired.
    quoteVersionConflicts: ambiguousCurrentQuoteRequests.size,
    awaitingCustomer: currentQuotes.filter(quote =>
      quote.status === "SENT" &&
      (snapshotAt === undefined || (clockValid && !needsSentQuoteExpiryReview(quote, snapshotAt)))).length,
    sentNeedsExpiryReview: snapshotAt !== undefined && clockValid ? currentQuotes.filter(quote =>
      needsSentQuoteExpiryReview(quote, snapshotAt)).length : 0,
    readyToSend: currentQuotes.filter(quote =>
      quote.status === "APPROVED" &&
      (snapshotAt === undefined || (clockValid && !needsApprovedQuoteExpiryReview(quote, snapshotAt)))).length,
    approvedNeedsExpiryReview: snapshotAt !== undefined && clockValid ? currentQuotes.filter(quote =>
      needsApprovedQuoteExpiryReview(quote, snapshotAt)).length : 0,
    quoteClockUnverified: snapshotAt !== undefined && !clockValid,
  };
}

export function isCurrentApprovedQuote<T extends QuotePipelineRecord>(
  quote: T,
  currentQuoteByRequest: ReadonlyMap<string, T>,
): boolean {
  return quote.status === "APPROVED" && currentQuoteByRequest.get(quote.requestId)?.id === quote.id;
}
