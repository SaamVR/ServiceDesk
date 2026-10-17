import type { OperationalBranchScope, OperationalServiceCatalogItem } from "./operational-product-runtime";

export interface OwnerPricingBookProof {
  state: "VERIFIED" | "UNAVAILABLE";
  activeBranchIds: string[];
}

/** Catalog presence is not proof of an activated price book. */
export function availableFirstRunUsdBranches(
  scope?: OperationalBranchScope,
  proof?: OwnerPricingBookProof,
): NonNullable<OperationalBranchScope["branches"]> {
  if (proof?.state !== "VERIFIED" || !scope) return [];
  const configured = new Set(proof.activeBranchIds);
  return scope.branches.filter(branch =>
    branch.currency === "USD" && !configured.has(branch.id) &&
    (scope.mode !== "BRANCH" || scope.selectedBranchId === branch.id)
  );
}

/**
 * The current cleaning quote engine only resolves these saved service codes.
 * Arbitrary active catalog items (e.g. window cleaning) cannot make a branch
 * ready to issue an actual STANDARD/DEEP/MOVE_OUT quote.
 */
export function countQuoteableCleaningServices(
  catalog?: readonly Pick<OperationalServiceCatalogItem, "active" | "code">[],
): number {
  return catalog?.filter(item =>
    item.active && (item.code === "STANDARD" || item.code === "DEEP" || item.code === "MOVE_OUT")
  ).length ?? 0;
}
