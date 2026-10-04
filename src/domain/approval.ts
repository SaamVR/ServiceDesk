export interface QuoteApproval {
  quoteId: string;
  quoteVersion: number;
  approverUserId: string;
  approvedAt: string;
}

export interface ApproveQuoteInput {
  quoteId: string;
  quoteVersion: number;
  approverUserId: string;
  now: string;
}

export interface QuoteVersionRef {
  id: string;
  version: number;
}

export function approveQuote(input: ApproveQuoteInput): QuoteApproval {
  if (!input.quoteId) throw new Error("quoteId is required");
  if (!Number.isInteger(input.quoteVersion) || input.quoteVersion < 1) throw new RangeError("quoteVersion must be a positive integer");
  if (!input.approverUserId) throw new Error("approverUserId is required");

  return {
    quoteId: input.quoteId,
    quoteVersion: input.quoteVersion,
    approverUserId: input.approverUserId,
    approvedAt: input.now,
  };
}

export function isApprovalCurrent(approval: QuoteApproval, quote: QuoteVersionRef): boolean {
  return approval.quoteId === quote.id && approval.quoteVersion === quote.version;
}
