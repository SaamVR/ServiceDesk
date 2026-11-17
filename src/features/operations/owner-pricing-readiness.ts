import type { OperationalBranchScope, OperationalServiceCatalogItem } from "./operational-product-runtime";

export interface OwnerPricingBookProof {
  state: "VERIFIED" | "UNAVAILABLE";
  /** Branches with exactly one currently effective, complete, quotable card. */
  activeBranchIds: string[];
  /** Branches with ANY existing active saved book, including broken pricing. */
  existingBookBranchIds?: string[];
}

/** A VERIFIED label alone is insufficient: contradictory, duplicate or out-of-scope
 * rate-book evidence must never expose a potentially destructive first-run form.
 * This is UI safety, not a replacement for server authorization or SQL locks.
 */
export function verifiedUsdPricingBookInventory(
  scope?: OperationalBranchScope,
  proof?: OwnerPricingBookProof,
): boolean {
  if (!scope || proof?.state !== "VERIFIED" ||
      !Array.isArray(scope.branches) ||
      !Array.isArray(proof.existingBookBranchIds) ||
      !Array.isArray(proof.activeBranchIds)) return false;
  const authorizedUsdIds = new Set(scope.branches
    .filter(branch => branch.currency === "USD").map(branch => branch.id));
  const existing = proof.existingBookBranchIds;
  const active = proof.activeBranchIds;
  return existing.every(id => typeof id === "string" && authorizedUsdIds.has(id)) &&
    active.every(id => typeof id === "string" &&
      authorizedUsdIds.has(id) && existing.includes(id)) &&
    new Set(existing).size === existing.length &&
    new Set(active).size === active.length;
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
  if (!verifiedUsdPricingBookInventory(scope, proof) || !scope || !proof) return [];
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
  if (!verifiedUsdPricingBookInventory(scope, proof) || !scope || !proof) return [];
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
  // A duplicated catalog read must not inflate the number of supported
  // service TYPES (3 copies of STANDARD are still only one quotable type).
  // This is a UI-readiness count, not an authorization or saved-rate proof.
  if (!catalog) return 0;
  return new Set(catalog.filter(item =>
    item.active && (item.code === "STANDARD" || item.code === "DEEP" || item.code === "MOVE_OUT")
  ).map(item => item.code)).size;
}
