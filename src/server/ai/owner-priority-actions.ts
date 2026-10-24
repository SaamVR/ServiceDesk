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
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 7) return null;
  // Never evaluate getters, inherited keys, symbols or proxy-substituted
  // values inside a supposedly verified saved-counts source. Snapshot seven
  // inert own data descriptors before computing merchant priorities.
  const expected:readonly (keyof VerifiedOwnerQueueFacts)[] = [
    "openRequests", "waitingOnCustomerQuotes", "quoteValidityNeedsReview",
    "collectibleInvoices", "invoiceLedgersNeedingReview",
    "unassignedActiveVisits", "unresolvedCriticalAttentions",
  ];
  const verified = {} as VerifiedOwnerQueueFacts;
  try {
    if (!facts || typeof facts !== "object" || Array.isArray(facts) ||
        Object.getPrototypeOf(facts) !== Object.prototype) return null;
    const keys = Reflect.ownKeys(facts);
    if (keys.length !== expected.length ||
        keys.some(key => typeof key !== "string" ||
          !expected.includes(key as keyof VerifiedOwnerQueueFacts))) return null;
    const descriptors = Object.getOwnPropertyDescriptors(facts);
    for (const key of expected) {
      const descriptor = descriptors[key];
      if (!descriptor || !Object.hasOwn(descriptor, "value") ||
          descriptor.enumerable !== true || typeof descriptor.value !== "number" ||
          !Number.isSafeInteger(descriptor.value) ||
          descriptor.value < 0 || descriptor.value > 5000) return null;
      verified[key] = descriptor.value;
    }
  } catch {
    // Proxy traps may throw. Missing trust is not an all-clear owner queue.
    return null;
  }
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
      label:"Collectible invoices to review",instruction:"Review saved collectible invoice evidence before any collection decision.",
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
  return table.filter(([key]) => verified[key] > 0).slice(0,limit)
    .map(([key,info]) => ({
      ...info,count:verified[key],source:"VERIFIED_SAVED_QUEUE_COUNT" as const,
    }));
}
