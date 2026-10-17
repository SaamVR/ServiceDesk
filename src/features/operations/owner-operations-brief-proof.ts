/**
 * Client display gate for a saved-count owner AI advisory.
 * Facts are independently verified server-side with two saved snapshots.
 * This client copies only seven bounded nonnegative integer queue counts.
 */
export interface VerifiedOwnerBriefFacts {
  openRequests: number;
  waitingOnCustomerQuotes: number;
  quoteValidityNeedsReview: number;
  collectibleInvoices: number;
  invoiceLedgersNeedingReview: number;
  unassignedActiveVisits: number;
  unresolvedCriticalAttentions: number;
}

export const OWNER_BRIEF_FACT_KEYS = [
  "openRequests", "waitingOnCustomerQuotes", "quoteValidityNeedsReview",
  "collectibleInvoices", "invoiceLedgersNeedingReview",
  "unassignedActiveVisits", "unresolvedCriticalAttentions",
] as const satisfies readonly (keyof VerifiedOwnerBriefFacts)[];

export interface VerifiedOwnerBrief {
  source: "AUTHORIZED_SAVED_WORKSPACE_COUNTS";
  model: string;
  brief: string;
  facts: VerifiedOwnerBriefFacts;
}

export function parseVerifiedOwnerBrief(value: unknown): VerifiedOwnerBrief | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.ok !== true ||
      record.source !== "AUTHORIZED_SAVED_WORKSPACE_COUNTS" ||
      typeof record.model !== "string" || !record.model.trim() ||
      record.model.length > 100 || /[\u0000-\u001f\u007f]/.test(record.model) ||
      typeof record.brief !== "string" || !record.brief.trim() ||
      record.brief.length > 900 ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(record.brief) ||
      !record.facts || typeof record.facts !== "object" ||
      Array.isArray(record.facts)) return null;

  const facts = record.facts as Record<string, unknown>;
  if (Object.keys(facts).length !== OWNER_BRIEF_FACT_KEYS.length ||
      OWNER_BRIEF_FACT_KEYS.some(key =>
        !Object.prototype.hasOwnProperty.call(facts, key) ||
        !Number.isSafeInteger(facts[key]) ||
        (facts[key] as number) < 0 || (facts[key] as number) > 5000)) {
    return null;
  }

  return {
    source: "AUTHORIZED_SAVED_WORKSPACE_COUNTS",
    model: record.model,
    brief: record.brief,
    facts: {
      openRequests: facts.openRequests as number,
      waitingOnCustomerQuotes: facts.waitingOnCustomerQuotes as number,
      quoteValidityNeedsReview: facts.quoteValidityNeedsReview as number,
      collectibleInvoices: facts.collectibleInvoices as number,
      invoiceLedgersNeedingReview: facts.invoiceLedgersNeedingReview as number,
      unassignedActiveVisits: facts.unassignedActiveVisits as number,
      unresolvedCriticalAttentions: facts.unresolvedCriticalAttentions as number,
    },
  };
}
