/**
 * Presentation-only owner AI result gate. The canonical AI-B server lane owns
 * saved counts and priority ranking. This client may display its bounded,
 * read-only actions but must never create or reprioritize them.
 */
export interface VerifiedOwnerPriorityAction {
  key: "CRITICAL_ATTENTION" | "LEDGER_REVIEW" | "QUOTE_VALIDITY" |
    "UNASSIGNED_VISIT" | "COLLECTIBLE_INVOICE" | "WAITING_QUOTE" | "OPEN_REQUEST";
  count: number;
  module: "overview" | "requests" | "quotes" | "schedule" | "invoices";
  priority: "CRITICAL" | "HIGH" | "NORMAL";
  title: string;
  detail: string;
}

export interface VerifiedOwnerBrief {
  source: "AUTHORIZED_SAVED_WORKSPACE_COUNTS";
  model: string;
  brief: string;
  /** Canonical SONIC AI-B always returns a source-verified priority array. */
  priorityActions: VerifiedOwnerPriorityAction[];
}

// UI labels and routes are fixed local constants. Arbitrary backend/model
// label or instruction fields are NEVER displayed.
const allowed = [
  { key: "CRITICAL_ATTENTION", module: "overview", priority: "CRITICAL",
    title: "Critical attention items", detail: "Review saved unresolved critical alerts." },
  { key: "LEDGER_REVIEW", module: "invoices", priority: "HIGH",
    title: "Invoice ledger checks", detail: "Review saved invoice ledger evidence." },
  { key: "QUOTE_VALIDITY", module: "quotes", priority: "HIGH",
    title: "Quote validity checks", detail: "Review saved quote validity evidence." },
  { key: "UNASSIGNED_VISIT", module: "schedule", priority: "HIGH",
    title: "Unassigned active visits", detail: "Review saved visits and dispatch capacity." },
  { key: "COLLECTIBLE_INVOICE", module: "invoices", priority: "NORMAL",
    title: "Collectible invoices", detail: "Check the saved invoice ledger manually." },
  { key: "WAITING_QUOTE", module: "quotes", priority: "NORMAL",
    title: "Quotes awaiting customers", detail: "Review saved quote status and consent." },
  { key: "OPEN_REQUEST", module: "requests", priority: "NORMAL",
    title: "Open service requests", detail: "Review persisted intake requests." },
] as const;

export function parseVerifiedOwnerPriorityActions(
  value: unknown,
): VerifiedOwnerPriorityAction[] | null {
  if (!Array.isArray(value) || value.length > 5) return null;
  let lastIndex = -1;
  const sanitized: VerifiedOwnerPriorityAction[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw) ||
        Object.getPrototypeOf(raw) !== Object.prototype) return null;
    const item = raw as Record<string, unknown>;
    const index = allowed.findIndex(option => option.key === item.key);
    if (index <= lastIndex) return null; // strict order, no duplicates
    const template = allowed[index];
    if (!template || item.source !== "VERIFIED_SAVED_QUEUE_COUNT" ||
        item.module !== template.module ||
        item.priority !== template.priority ||
        typeof item.count !== "number" || !Number.isSafeInteger(item.count) ||
        item.count < 1 || item.count > 5000) return null;
    sanitized.push({
      key: template.key,
      count: item.count,
      module: template.module,
      priority: template.priority,
      title: template.title,
      detail: template.detail,
    });
    lastIndex = index;
  }
  return sanitized;
}

/** A model may infer private identities or falsely say a business action
 * happened from aggregate queue counts alone. Restrict display of free-text
 * claims while retaining the separately verified deterministic action list.
 * This is defense in depth, not semantic proof of every model assertion.
 */
export function containsUnsafeOwnerBriefClaims(input:unknown):boolean{
  if(typeof input!=="string")return true;
  return /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/u.test(input) ||
    /(?:https?:\/\/|www\.|mailto:|tel:)/iu.test(input) ||
    /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/iu.test(input) ||
    /\+?\d[\d\s().-]{8,}\d/u.test(input) ||
    /[$€£₹৳]/u.test(input) ||
    /<\s*\/?\s*[a-z][^>]*>/iu.test(input) ||
    /\b(?:api[_ -]?key|bearer\s+[a-z0-9._-]+|password\s*:)/iu.test(input) ||
    /\b(?:payment\s+(?:received|confirmed|completed|approved|collected)|invoice\s+(?:paid|settled)|deposit\s+(?:paid|received)|customer\s+(?:notified|contacted)|message\s+(?:sent|delivered)|booking\s+(?:confirmed|completed)|appointment\s+confirmed|visit\s+(?:completed|confirmed)|refund\s+(?:issued|processed)|automati(?:on|cally)\s+(?:executed|sent|completed))\b/iu.test(input) ||
    /\b(?:total(?:\s+(?:cost|price|amount))?|charge|deposit|balance|invoice\s+(?:total|amount)|price)\s*(?::|=|is|of|should\s+be)?\s*\d+(?:[.,]\d+)?\b/iu.test(input);
}

export function parseVerifiedOwnerBrief(value: unknown): VerifiedOwnerBrief | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.ok !== true ||
      record.source !== "AUTHORIZED_SAVED_WORKSPACE_COUNTS" ||
      typeof record.model !== "string" || !record.model.trim() ||
      record.model.length > 100 || !/^[A-Za-z0-9._:/-]{1,100}$/.test(record.model) ||
      typeof record.brief !== "string" || !record.brief.trim() ||
      record.brief.length > 900 ||
      containsUnsafeOwnerBriefClaims(record.brief)) return null;

  // SONIC AI-B server action ALWAYS returns the bounded priority array.
  // Missing evidence must not masquerade as an empty verified work queue.
  const priorityActions = parseVerifiedOwnerPriorityActions(record.priorityActions);
  if (priorityActions === null) return null;
  return {
    source: "AUTHORIZED_SAVED_WORKSPACE_COUNTS",
    model: record.model,
    brief: record.brief,
    priorityActions,
  };
}
