/** Read-only navigation recommendations derived only from already-authorized,
 * fresh numeric owner queue counts. Never imply a task is overdue, a model
 * executed work, or an outgoing message/charge was authorized. */
export type OwnerPriorityModule = "overview" | "requests" | "quotes" | "schedule" | "invoices";
export interface OwnerPriorityAction {
  key: "CRITICAL_ATTENTION" | "LEDGER_REVIEW" | "QUOTE_VALIDITY" |
    "UNASSIGNED_VISIT" | "COLLECTIBLE_INVOICE" | "WAITING_QUOTE" | "OPEN_REQUEST";
  count: number;
  module: OwnerPriorityModule;
  label: string;
  instruction: string;
  priority: "CRITICAL" | "HIGH" | "NORMAL";
  source: "VERIFIED_SAVED_QUEUE_COUNT";
}

export interface VerifiedOwnerQueueFacts {
  openRequests: number;
  waitingOnCustomerQuotes: number;
  quoteValidityNeedsReview: number;
  collectibleInvoices: number;
  invoiceLedgersNeedingReview: number;
  unassignedActiveVisits: number;
  unresolvedCriticalAttentions: number;
}

/** Returns null for poisoned/unavailable facts instead of showing false zeroes. */
export function ownerPriorityActions(
  facts: VerifiedOwnerQueueFacts,
  limit = 5,
): OwnerPriorityAction[] | null {
  if (!facts || typeof facts !== "object" || Array.isArray(facts) ||
      Object.getPrototypeOf(facts) !== Object.prototype ||
      !Number.isSafeInteger(limit) || limit < 1 || limit > 7) return null;
  // The seven saved source buckets are named and allowlisted; a list of
  // seven values, a prototype-injected object or a missing key must never be
  // mistaken for a verified "zero outstanding work" owner snapshot.
  const expected = [
    "openRequests", "waitingOnCustomerQuotes", "quoteValidityNeedsReview",
    "collectibleInvoices", "invoiceLedgersNeedingReview",
    "unassignedActiveVisits", "unresolvedCriticalAttentions",
  ];
  if (Object.keys(facts).length !== expected.length ||
      expected.some(key => !Object.hasOwn(facts,key))) return null;
  const values = Object.values(facts);
  if (values.some(value => typeof value !== "number" ||
        !Number.isSafeInteger(value) || value < 0 || value > 5000)) return null;
  const table: Array<[keyof VerifiedOwnerQueueFacts, Omit<OwnerPriorityAction, "count" | "source">]> = [
    ["unresolvedCriticalAttentions", {
      key:"CRITICAL_ATTENTION",module:"overview",priority:"CRITICAL",
      label:"Critical attention requires review",instruction:"Review the saved exception queue before assigning next steps.",
    }],
    ["invoiceLedgersNeedingReview", {
      key:"LEDGER_REVIEW",module:"invoices",priority:"HIGH",
      label:"Invoice ledger evidence needs review",instruction:"Open the saved ledger and verify the financial discrepancy.",
    }],
    ["quoteValidityNeedsReview", {
      key:"QUOTE_VALIDITY",module:"quotes",priority:"HIGH",
      label:"Quote validity needs review",instruction:"Inspect the saved quote validity evidence before any customer handoff.",
    }],
    ["unassignedActiveVisits", {
      key:"UNASSIGNED_VISIT",module:"schedule",priority:"HIGH",
      label:"Active visits without crew assignments",instruction:"Inspect real dispatch capacity and approve a suitable assignment.",
    }],
    ["collectibleInvoices", {
      key:"COLLECTIBLE_INVOICE",module:"invoices",priority:"NORMAL",
      label:"Collectible invoices to review",instruction:"Review verified outstanding balances; do not assume a payment is overdue.",
    }],
    ["waitingOnCustomerQuotes", {
      key:"WAITING_QUOTE",module:"quotes",priority:"NORMAL",
      label:"Quotes awaiting customer review",instruction:"Inspect saved customer-facing quote status and consent before any follow-up.",
    }],
    ["openRequests", {
      key:"OPEN_REQUEST",module:"requests",priority:"NORMAL",
      label:"Open service requests to qualify",instruction:"Inspect saved requests for missing service details and next steps.",
    }],
  ];
  return table.filter(([key]) => facts[key] > 0).slice(0,limit)
    .map(([key,info]) => ({
      ...info,count:facts[key],source:"VERIFIED_SAVED_QUEUE_COUNT" as const,
    }));
}
