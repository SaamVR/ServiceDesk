import type { OperationalBranchScope } from "./operational-product-runtime";

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
