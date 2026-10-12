import type {
  OperationalBranchScope, OperationalServiceCatalogItem,
} from "@/features/operations/operational-product-runtime";
import {
  availableFirstRunUsdBranches,
  type OwnerPricingBookProof,
} from "@/features/operations/owner-pricing-readiness";

export type CommercialSetupState = "VERIFIED" | "NEEDS_SERVICE" | "NEEDS_PRICE_BOOK" | "UNVERIFIED" | "UNSUPPORTED_CURRENCY";
export interface CommercialSetupEvidence {
  state: CommercialSetupState;
  activeServices: number;
  eligibleUsdBranches: number;
  missingPriceBookBranches: number;
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
  const common = { activeServices };
  if (!input.catalog) {
    return {
      ...common, state: "UNVERIFIED", eligibleUsdBranches: 0,
      missingPriceBookBranches: 0,
      detail: "The saved service catalog could not be verified. Reload Settings before taking a quote.",
    };
  }
  if (activeServices === 0) {
    return {
      ...common, state: "NEEDS_SERVICE", eligibleUsdBranches: 0,
      missingPriceBookBranches: 0,
      detail: "Create your actual cleaning services and their business-owned prices in Settings before quoting.",
    };
  }
  if (!input.scope || input.proof?.state !== "VERIFIED") {
    return {
      ...common, state: "UNVERIFIED", eligibleUsdBranches: 0,
      missingPriceBookBranches: 0,
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
      missingPriceBookBranches: 0,
      detail: "No USD branch is available in this owner view. The first-run USD setup cannot verify these branches.",
    };
  }
  const missing = availableFirstRunUsdBranches(input.scope, input.proof);
  if (missing.length) {
    return {
      ...common, state: "NEEDS_PRICE_BOOK", eligibleUsdBranches: eligible.length,
      missingPriceBookBranches: missing.length,
      detail: missing.length === 1
        ? `“${missing[0].name}” has no verified active branch price book. Enter your business's actual rates in Settings.`
        : `${missing.length} of ${eligible.length} USD branches have no verified active branch price book. Enter actual rates in Settings.`,
    };
  }
  return {
    ...common, state: "VERIFIED", eligibleUsdBranches: eligible.length,
    missingPriceBookBranches: 0,
    detail: `An active price book is recorded for ${eligible.length} authorized USD branch${eligible.length === 1 ? "" : "es"}. Individual quotes still require validated services, rates, scope and staff review.`,
  };
}
