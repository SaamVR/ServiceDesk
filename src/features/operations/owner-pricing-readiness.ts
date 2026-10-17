import type { OperationalBranchScope, OperationalServiceCatalogItem } from "./operational-product-runtime";

export interface OwnerPricingBookProof {
  state: "VERIFIED" | "UNAVAILABLE";
  /** Branches with exactly one currently effective, complete, quotable card. */
  activeBranchIds: string[];
  /** Branches with ANY existing active saved book, including broken pricing. */
  existingBookBranchIds?: string[];
}

function eligibleUsdBranch(scope: OperationalBranchScope, id: string, currency: string): boolean {
  return currency === "USD" && (scope.mode !== "BRANCH" || scope.selectedBranchId === id);
}

/**
 * The first-run SQL refuses to overwrite any active branch_price_books row.
 * Missing a VERIFIED quoteable price is not proof that no active book exists.
 * If the independent existing-book read is absent/denied, offer no setup action.
 */
export function availableFirstRunUsdBranches(
  scope?: OperationalBranchScope,
  proof?: OwnerPricingBookProof,
): NonNullable<OperationalBranchScope["branches"]> {
  if (proof?.state !== "VERIFIED" || !scope ||
      !Array.isArray(proof.existingBookBranchIds)) return [];
  const existing = new Set(proof.existingBookBranchIds);
  return scope.branches.filter(branch =>
    eligibleUsdBranch(scope, branch.id, branch.currency) && !existing.has(branch.id)
  );
}

/** A saved active book is present but is not authorized for a real quote.
 * Send the owner to review existing pricing, NEVER to first-run overwrite.
 */
export function invalidExistingUsdBranches(
  scope?: OperationalBranchScope,
  proof?: OwnerPricingBookProof,
): NonNullable<OperationalBranchScope["branches"]> {
  if (proof?.state !== "VERIFIED" || !scope ||
      !Array.isArray(proof.existingBookBranchIds)) return [];
  const existing = new Set(proof.existingBookBranchIds);
  const quoteable = new Set(proof.activeBranchIds);
  return scope.branches.filter(branch =>
    eligibleUsdBranch(scope, branch.id, branch.currency) &&
    existing.has(branch.id) && !quoteable.has(branch.id)
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
