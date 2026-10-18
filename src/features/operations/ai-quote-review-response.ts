/**
 * Browser display boundary for a guarded staff-only saved quote model reply.
 * The server checks actor, branch, quote version and grounding before issuing
 * the response; the browser independently refuses a stale/cross-quote reply.
 */
export interface VerifiedStaffQuoteReview {
  state: "AI_STAFF_REVIEW_ONLY";
  quoteId: string;
  model: string;
  review: string;
  source: "VERIFIED_SAVED_QUOTE_CODES_NO_AMOUNTS";
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** A saved quote can contain service codes and durations, never customer
 * contact or financial facts in the AI reviewer prompt. A model may still
 * hallucinate such facts in its answer. Do not display fabricated prices,
 * contacts or redirects as trusted staff advice. This is a defense-in-depth
 * text gate, NOT semantic proof that all model claims are accurate.
 */
export function containsUnsafeQuoteReviewClaims(input:string):boolean{
  return /[\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/iu.test(input) ||
    /https?:\/\/|www\.|mailto:|tel:/iu.test(input) ||
    /[\w.+-]+@[\w.-]+\.[a-z]{2,}/iu.test(input) ||
    /[$€£₹৳]/u.test(input) ||
    /\b(?:USD|EUR|GBP|BDT|INR)\s*[0-9]/iu.test(input) ||
    /\b[0-9]+(?:\.[0-9]{1,2})?\s*(?:USD|EUR|GBP|BDT|INR)\b/iu.test(input) ||
    /\+?[0-9][0-9\s().-]{8,}[0-9]/u.test(input) ||
    /<\/?[a-z][^>]*>/iu.test(input) ||
    /\b(?:api[_ -]?key|bearer\s+[a-z0-9._-]+|password\s*:)/iu.test(input);
}

export function parseAuthorizedQuoteReview(
  value: unknown,
  expectedQuoteId: string,
): VerifiedStaffQuoteReview | null {
  if (!uuid.test(expectedQuoteId) || !value ||
      typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (candidate.state !== "AI_STAFF_REVIEW_ONLY" ||
      candidate.source !== "VERIFIED_SAVED_QUOTE_CODES_NO_AMOUNTS" ||
      candidate.quoteId !== expectedQuoteId ||
      typeof candidate.model !== "string" || !candidate.model.trim() ||
      candidate.model.length > 100 || !/^[A-Za-z0-9._:/-]{1,100}$/.test(candidate.model) ||
      typeof candidate.review !== "string" || !candidate.review.trim() ||
      candidate.review.length > 900 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(candidate.review) ||
      containsUnsafeQuoteReviewClaims(candidate.review)) {
    return null;
  }
  // Discard response extras. They are not authorized to become UI content.
  return {
    state: "AI_STAFF_REVIEW_ONLY",
    quoteId: expectedQuoteId,
    source: "VERIFIED_SAVED_QUOTE_CODES_NO_AMOUNTS",
    model: candidate.model,
    review: candidate.review,
  };
}

/** Stable operator-facing messages. Provider errors or response bodies never
 * reach this display directly; no output claims a message or payment occurred.
 */
export function describeQuoteReviewHttpFailure(status: number): string {
  if (status === 400 || status === 415) return "The saved quote review request was rejected. Refresh the quote and retry.";
  if (status === 401 || status === 403) return "You no longer have verified access to review this quote with AI. Refresh your session or branch.";
  if (status === 404) return "The selected saved quote is no longer eligible for AI review. Check the authoritative quote record.";
  if (status === 408 || status === 504) return "The AI quote review timed out. The saved quote remains available for staff review.";
  if (status === 429) return "AI quota or rate limits were reached. Avoid rapid retries; ordinary quoting still works.";
  if (status === 502 || status === 503) return "The AI reviewer is unavailable. Verify the saved quote manually; no customer message was sent.";
  return "AI review could not be verified. Check the saved quote and protected server diagnostics.";
}
