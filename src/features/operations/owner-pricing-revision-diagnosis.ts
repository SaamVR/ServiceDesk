import { parsePersistedQuoteRateCard, parsePriceBookWindowInstant } from "@/server/core/operational-quote-rate-card";

export interface SavedBranchPricingDiagnosis {
  state: "READY_CANDIDATE" | "REPAIR_REQUIRED";
  code: "CURRENT_SAVED_PRICING" | "RATE_CARD_MISSING" | "RATE_CARD_INVALID" |
    "RATE_CURRENCY_MISMATCH" | "WINDOW_INVALID" | "NOT_EFFECTIVE" | "NO_ACTIVE_CATALOG";
  message: string;
}

/**
 * Owner-only saved-rate diagnostic. Reuses exact business quote parsers rather
 * than guessing from the presence of a branch_price_books row. A positive
 * candidate is NOT a quote approval: the request and branch are rechecked on
 * each quote command. Does not expose this evidence to anonymous/staff roles.
 */
export function diagnoseSavedBranchPricing(input: {
  branchCurrency: string;
  card: unknown;
  startsAt: unknown;
  endsAt: unknown;
  serviceCatalogComplete: boolean;
  now?: number;
}): SavedBranchPricingDiagnosis {
  if (!input.serviceCatalogComplete) {
    return { state: "REPAIR_REQUIRED", code: "NO_ACTIVE_CATALOG",
      message: "The shared cleaning catalog is incomplete. Restore active STANDARD, DEEP and MOVE_OUT services in Settings first." };
  }
  if (!input.card) {
    return { state: "REPAIR_REQUIRED", code: "RATE_CARD_MISSING",
      message: "This active branch book refers to a missing rate card. Replace its prices before issuing quotes." };
  }
  const rate = parsePersistedQuoteRateCard(input.card);
  if (!rate.ok) {
    return { state: "REPAIR_REQUIRED", code: "RATE_CARD_INVALID",
      message: rate.message + " Re-enter all rates and durations in this worksheet." };
  }
  if (rate.value.currency !== input.branchCurrency) {
    return { state: "REPAIR_REQUIRED", code: "RATE_CURRENCY_MISMATCH",
      message: "The saved rate card currency disagrees with the branch denomination. Enter replacement USD prices." };
  }
  const start = parsePriceBookWindowInstant(input.startsAt);
  const end = parsePriceBookWindowInstant(input.endsAt);
  if (start === undefined || end === undefined ||
      (start !== null && end !== null && start >= end)) {
    return { state: "REPAIR_REQUIRED", code: "WINDOW_INVALID",
      message: "The saved book has invalid or contradictory effective timestamps. A successful replacement will start with an open-ended current period." };
  }
  const now = input.now ?? Date.now();
  if (!Number.isFinite(now)) {
    return { state: "REPAIR_REQUIRED", code: "WINDOW_INVALID",
      message: "The verification clock is unavailable. Pricing cannot be asserted ready." };
  }
  if ((start !== null && start > now) || (end !== null && end <= now)) {
    return { state: "REPAIR_REQUIRED", code: "NOT_EFFECTIVE",
      message: "The saved book is not currently effective. Replacement creates an explicit current open-ended book." };
  }
  return { state: "READY_CANDIDATE", code: "CURRENT_SAVED_PRICING",
    message: "Saved pricing and dates pass standalone checks. Request-specific quote eligibility is verified separately." };
}
