import { readVerifiedCustomerQuoteLineItems, type CustomerQuoteLineItem } from "./customer-quote-line-items";

/** Deterministic next steps derived from the currently authorized saved request.
 * This does not persist AI guesses, mutate quotes, or imply provider delivery. */
export interface CleaningRequestNextStepsInput {
  serviceActive: boolean;
  bedrooms?: number;
  bathrooms?: number;
  pricingState: "VERIFIED" | "UNVERIFIED" | "MISSING";
  currentQuote?: {
    status: string; totalMinor: number; currency: string;
    subtotalMinor?: number; taxMinor?: number; depositMinor?: number;
    balanceMinor?: number; durationMinutes?: number;
    lineItems?: CustomerQuoteLineItem[] | null;
    validUntil?: string;
  };
  requestedStartAt?: string;
  /** Time of this staff read; injectable for deterministic expiry tests. */
  asOf?: string;
}
export interface CleaningRequestStep {
  id: "service" | "rooms" | "pricing" | "quote";
  label: string;
  state: "DONE" | "ACTION_REQUIRED" | "UNVERIFIED";
  detail: string;
}
export function cleaningRequestNextSteps(input: CleaningRequestNextStepsInput): {
  complete: number;
  steps: CleaningRequestStep[];
  quoteReady: boolean;
} {
  const roomsValid = Number.isSafeInteger(input.bedrooms) &&
    Number.isSafeInteger(input.bathrooms) &&
    (input.bedrooms ?? -1) >= 0 && (input.bedrooms ?? 11) <= 10 &&
    (input.bathrooms ?? -1) >= 0 && (input.bathrooms ?? 11) <= 10;
  const quote = input.currentQuote;
  const terminalQuote = Boolean(quote && ["DECLINED", "REJECTED", "EXPIRED", "SUPERSEDED"].includes(quote.status));
  const savedQuotePresent = Boolean(quote &&
    ["DRAFT", "PENDING_APPROVAL", "APPROVED", "SENT", "ACCEPTED",
      "DECLINED", "REJECTED", "EXPIRED", "SUPERSEDED"].includes(quote.status) &&
    quote.currency === "USD" && Number.isSafeInteger(quote.totalMinor) &&
    quote.totalMinor > 0);
  // A saved status and plausible total do not establish an approved price.
  // Reuse the customer-facing exact line-item reader and persisted deposit
  // reconciliation; never fill in missing lines or zero-valued unknowns.
  const confirmedQuote = Boolean(savedQuotePresent && !terminalQuote && quote &&
    Number.isSafeInteger(quote.subtotalMinor) &&
    Number.isSafeInteger(quote.taxMinor) &&
    Number.isSafeInteger(quote.depositMinor) &&
    Number.isSafeInteger(quote.balanceMinor) &&
    Number.isSafeInteger(quote.durationMinutes) &&
    quote.depositMinor! >= 0 && quote.balanceMinor! >= 0 &&
    quote.depositMinor! + quote.balanceMinor! === quote.totalMinor &&
    readVerifiedCustomerQuoteLineItems(
      { lineItems: quote.lineItems }, quote.subtotalMinor!, quote.durationMinutes!,
      quote.taxMinor!, quote.totalMinor,
    ) !== null);
  // An approved/sent quote is no longer staff-actionable after its validity
  // deadline. An absent/invalid timestamp cannot be treated as a fresh offer.
  // ACCEPTED is final: expiry of an already accepted quote does not undo it.
  const asOf = input.asOf === undefined ? Date.now() : Date.parse(input.asOf);
  const expiryReviewRequired = Boolean(confirmedQuote && quote &&
    ["APPROVED", "SENT"].includes(quote.status) &&
    (!Number.isFinite(asOf) ||
      typeof quote.validUntil !== "string" ||
      !Number.isFinite(Date.parse(quote.validUntil)) ||
      Date.parse(quote.validUntil) <= asOf));
  const steps: CleaningRequestStep[] = [
    {id:"service",label:"Choose an active cleaning service",
      state:input.serviceActive?"DONE":"ACTION_REQUIRED",
      detail:input.serviceActive?"Saved active service verified.":"Owner must activate a real service before pricing."},
    {id:"rooms",label:"Confirm bedrooms and bathrooms",
      state:roomsValid?"DONE":"ACTION_REQUIRED",
      detail:roomsValid?"Room counts saved as staff-confirmed facts.":"Enter both room counts in the request form; do not rely on AI estimates."},
    {id:"pricing",label:"Verify the branch price book",
      state:input.pricingState==="VERIFIED"?"DONE":input.pricingState==="UNVERIFIED"?"UNVERIFIED":"ACTION_REQUIRED",
      detail:input.pricingState==="VERIFIED"?"Authorized branch rates verified.":input.pricingState==="UNVERIFIED"?"Price-book evidence unavailable; do not assume any rate.":"Owner must save approved rates for this request's branch."},
    {id:"quote",label:"Save a calculated quote",
      state:terminalQuote?"ACTION_REQUIRED":expiryReviewRequired?"ACTION_REQUIRED":confirmedQuote?"DONE":savedQuotePresent?"UNVERIFIED":"ACTION_REQUIRED",
      detail:terminalQuote
        ?"The saved quote is no longer actionable. Prepare a new verified quote rather than reusing a declined, rejected, expired or superseded quote."
        :expiryReviewRequired
          ?"The saved approved or sent quote has expired or its validity is unverified. Recalculate and verify an actionable offer; do not send or reuse the old quote."
        :confirmedQuote
          ?"A saved USD quote has reconciled charge lines and deposit. This does not mean it was delivered or paid."
        :savedQuotePresent
          ?"A saved quote status exists, but financial line items or deposit do not reconcile. Verify before using this quote."
          :"Staff must calculate and verify a persisted quote; preview totals are not enough."},
  ];
  return {
    complete:steps.filter(step=>step.state==="DONE").length,
    steps,
    quoteReady:input.serviceActive && roomsValid && input.pricingState==="VERIFIED",
  };
}
