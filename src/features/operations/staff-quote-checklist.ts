import { readVerifiedCustomerQuoteLineItems, type CustomerQuoteLineItem } from "./customer-quote-line-items";
import { trustedQuoteInstant } from "./quote-validity-clock";

export interface StaffQuoteChecklistFacts {
  status: string;
  validUntil?: string;
  currency: string;
  subtotalMinor?: number;
  taxMinor?: number;
  totalMinor: number;
  depositMinor: number;
  balanceMinor: number;
  durationMinutes: number;
  lineItems?: readonly CustomerQuoteLineItem[] | null;
}
export interface StaffQuoteChecklistItem {
  key: "charges" | "validity" | "approval" | "scope" | "delivery";
  state: "PASS" | "REVIEW" | "MANUAL";
  text: string;
}

/** Deterministic product checks on saved commercial evidence, not a model.
 * Never infer consent, payment, provider receipt or booking confirmation.
 */
export function buildStaffQuoteChecklist(
  quote: StaffQuoteChecklistFacts,
  nowIso: string,
): { readyForHumanReview: boolean; items: StaffQuoteChecklistItem[] } {
  const values = [quote.subtotalMinor, quote.taxMinor, quote.totalMinor,
    quote.depositMinor, quote.balanceMinor, quote.durationMinutes];
  const numbersSafe = values.every(n => typeof n === "number" &&
    Number.isSafeInteger(n) && n >= 0);
  const chargeMath = numbersSafe && quote.totalMinor > 0 &&
    quote.durationMinutes > 0 &&
    Number.isSafeInteger((quote.subtotalMinor as number) + (quote.taxMinor as number)) &&
    (quote.subtotalMinor as number) + (quote.taxMinor as number) === quote.totalMinor &&
    quote.depositMinor + quote.balanceMinor === quote.totalMinor;
  const lines = chargeMath && Array.isArray(quote.lineItems)
    ? readVerifiedCustomerQuoteLineItems(
      { lineItems: quote.lineItems },
      quote.subtotalMinor as number, quote.durationMinutes,
      quote.taxMinor as number, quote.totalMinor,
    ) : null;
  const verified = !!lines && /^[A-Z]{3}$/.test(quote.currency);
  // Match SEND and customer ACCEPT: a syntactically zoned but impossible
  // civil date, invalid UTC offset or exact expiry cannot justify staff PASS.
  // Also accept valid PostgreSQL microsecond timestamps.
  const now = trustedQuoteInstant(nowIso);
  const expiry = trustedQuoteInstant(quote.validUntil);
  const fresh = now !== null && expiry !== null && expiry > now;
  const internalStatus = ["APPROVED", "SENT"].includes(quote.status);

  const items: StaffQuoteChecklistItem[] = [
    { key: "charges", state: verified ? "PASS" : "REVIEW",
      text: verified
        ? "Saved service lines, duration, tax, deposit and balance reconcile."
        : "The saved quote charges or durations cannot be reconciled; do not send." },
    { key: "validity", state: fresh ? "PASS" : "REVIEW",
      text: fresh
        ? "The saved quote validity window has not expired."
        : "The quote is expired or its validity is unknown; refresh before sharing." },
    { key: "approval", state: internalStatus ? "PASS" : "REVIEW",
      text: internalStatus
        ? "The quote has an internal approved/sent status, not a delivery receipt."
        : "An authorized staff approval is still needed before customer handoff." },
    { key: "scope", state: "MANUAL",
      text: lines?.some(item => item.code === "OVEN")
        ? "Oven add-on appears in the saved scope; confirm the customer's choice."
        : "Confirm service scope and room counts with the customer before sharing." },
    { key: "delivery", state: "MANUAL",
      text: "Customer delivery, payment and booking require separate verified evidence." },
  ];
  return { readyForHumanReview: verified && fresh && internalStatus, items };
}
