import type {
  OperationalBranchScope, OperationalServiceCatalogItem,
} from "@/features/operations/operational-product-runtime";
import {
  availableFirstRunUsdBranches,
  invalidExistingUsdBranches,
  countQuoteableCleaningServices,
  type OwnerPricingBookProof,
} from "@/features/operations/owner-pricing-readiness";

export type CommercialSetupState = "VERIFIED" | "NEEDS_SERVICE" | "NEEDS_PRICE_BOOK" | "UNVERIFIED" | "UNSUPPORTED_CURRENCY";
export interface CommercialSetupEvidence {
  state: CommercialSetupState;
  activeServices: number;
  quoteableCleaningServices: number;
  eligibleUsdBranches: number;
  missingPriceBookBranches: number;
  /** Saved current books with no verified quote rate: never first-run overwrite. */
  repairPriceBookBranches: number;
  detail: string;
}

/**
 * This is read-only onboarding evidence, not an authorization or pricing
 * decision. It is intentionally more conservative than checking service count
 * alone. The quote engine remains the final source of pricing validity.
 */
export function summarizeOwnerCommercialSetup(input: {
  catalog?: readonly OperationalServiceCatalogItem[];
  scope?: OperationalBranchScope;
  proof?: OwnerPricingBookProof;
}): CommercialSetupEvidence {
  const activeServices = input.catalog?.filter(service => service.active).length ?? 0;
  // Catalog services may include non-cleaning products. Only quote engine
  // service codes can satisfy the cleaning quote onboarding prerequisite.
  const quoteableCleaningServices = countQuoteableCleaningServices(input.catalog);
  const common = { activeServices, quoteableCleaningServices };
  if (!input.catalog) {
    return {
      ...common, state: "UNVERIFIED", eligibleUsdBranches: 0,
      missingPriceBookBranches: 0, repairPriceBookBranches: 0,
      detail: "The saved service catalog could not be verified. Reload Settings before taking a quote.",
    };
  }
  if (quoteableCleaningServices === 0) {
    return {
      ...common, state: "NEEDS_SERVICE", eligibleUsdBranches: 0,
      missingPriceBookBranches: 0, repairPriceBookBranches: 0,
      detail: "Activate at least one saved Standard, Deep or Move-Out cleaning service and configure its business-owned price book before quoting.",
    };
  }
  if (!input.scope || input.proof?.state !== "VERIFIED") {
    return {
      ...common, state: "UNVERIFIED", eligibleUsdBranches: 0,
      missingPriceBookBranches: 0, repairPriceBookBranches: 0,
      detail: "Active service names alone do not verify branch pricing. Recheck your saved price books in Settings.",
    };
  }
  const eligible = input.scope.branches.filter(branch =>
    branch.currency === "USD" &&
    (input.scope?.mode !== "BRANCH" || input.scope.selectedBranchId === branch.id)
  );
  if (!eligible.length) {
    return {
      ...common, state: "UNSUPPORTED_CURRENCY", eligibleUsdBranches: 0,
      missingPriceBookBranches: 0, repairPriceBookBranches: 0,
      detail: "No USD branch is available in this owner view. The first-run USD setup cannot verify these branches.",
    };
  }
  // First-run is unsafe if a source read is missing or contradicts the
  // saved quotable-book read. A VERIFIED label alone cannot authorize setup.
  const existing = input.proof.existingBookBranchIds;
  const priced = input.proof.activeBranchIds;
  const allowedUsdIds = new Set(input.scope.branches
    .filter(branch => branch.currency === "USD").map(branch => branch.id));
  if (!Array.isArray(existing) || !Array.isArray(priced) ||
      existing.some(id => typeof id !== "string" || !allowedUsdIds.has(id)) ||
      priced.some(id => typeof id !== "string" ||
        !allowedUsdIds.has(id) || !existing.includes(id))) {
    return {
      ...common, state: "UNVERIFIED", eligibleUsdBranches: eligible.length,
      missingPriceBookBranches: 0, repairPriceBookBranches: 0,
      detail: "Saved branch price-book inventory disagrees with verified current rates, or its independent read is missing. Refresh Settings; no first-run setup or quote-readiness claim is safe.",
    };
  }

  // Distinct owner actions may be required simultaneously in a multi-branch
  // workspace. Never hide a genuinely unpriced branch just because another
  // branch has an invalid, non-overwritable saved book.
  const invalidSaved = invalidExistingUsdBranches(input.scope, input.proof);
  const missing = availableFirstRunUsdBranches(input.scope, input.proof);
  if (invalidSaved.length > 0) {
    const mixed = missing.length > 0
      ? ` Separately, ${missing.length} other authorized USD branch${missing.length === 1 ? "" : "es"} have no saved active price book; enter actual first-run rates for those branches only.`
      : "";
    return {
      ...common, state: "UNVERIFIED", eligibleUsdBranches: eligible.length,
      missingPriceBookBranches: missing.length,
      repairPriceBookBranches: invalidSaved.length,
      detail: (invalidSaved.length === 1
        ? `“${invalidSaved[0].name}” has existing active pricing, but no verified rate card can be used for a real quote. Review the saved book and effective dates in Settings; first-run setup cannot overwrite it.`
        : `${invalidSaved.length} USD branches have existing price books that cannot be verified for quotes. Review and repair their saved pricing in Settings; first-run setup cannot overwrite them.`) + mixed,
    };
  }
  if (missing.length) {
    return {
      ...common, state: "NEEDS_PRICE_BOOK", eligibleUsdBranches: eligible.length,
      missingPriceBookBranches: missing.length, repairPriceBookBranches: 0,
      detail: missing.length === 1
        ? `“${missing[0].name}” has no verified active branch price book. Enter your business's actual rates in Settings.`
        : `${missing.length} of ${eligible.length} USD branches have no verified active branch price book. Enter actual rates in Settings.`,
    };
  }
  return {
    ...common, state: "VERIFIED", eligibleUsdBranches: eligible.length,
    missingPriceBookBranches: 0, repairPriceBookBranches: 0,
    detail: `An active price book is recorded for ${eligible.length} authorized USD branch${eligible.length === 1 ? "" : "es"}. Individual quotes still require validated services, rates, scope and staff review.`,
  };
}
