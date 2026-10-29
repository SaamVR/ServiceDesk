import type { OperationalBranchScope } from "./operational-product-runtime";
import type { OwnerExistingPricingBook } from "@/server/core/owner-cleaning-pricing-revision";

export type PricingRevisionAccess =
  | { state: "READY_FOR_OWNER_REVIEW"; version: number; branchName: string }
  | { state: "UNVERIFIED_SCOPE" | "FOREIGN_BRANCH" | "UNVERIFIED_BOOK"; detail: string };

/** A saved repair target may be stale even when the parent route once
 * authorized an owner. Refuse to render an actionable revision form unless
 * it still belongs to the selected authorized USD branch snapshot. This is
 * read-only guidance: the server/RPC performs final membership + CAS checks.
 */
export function assessOwnerPricingRevisionAccess(
  scope: OperationalBranchScope | undefined,
  target: OwnerExistingPricingBook,
): PricingRevisionAccess {
  if (!scope || !Array.isArray(scope.branches) ||
      !["ALL", "BRANCH"].includes(scope.mode) || scope.branches.length === 0) {
    return { state: "UNVERIFIED_SCOPE", detail:
      "Authorized branch evidence is unavailable. Reload Settings before revising saved prices." };
  }
  const matches = scope.branches.filter(branch => branch.id === target.branch?.id);
  if (matches.length !== 1 ||
      (scope.mode === "BRANCH" && scope.selectedBranchId !== target.branch.id) ||
      matches[0].currency !== "USD" || target.branch.currency !== "USD" ||
      matches[0].code !== target.branch.code) {
    return { state: "FOREIGN_BRANCH", detail:
      "This price book is outside the selected authorized USD branch. Switch to its permitted branch in Settings and reload." };
  }
  if (typeof target.bookId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(target.bookId) ||
      !Number.isSafeInteger(target.bookVersion) ||
      target.bookVersion < 1 || target.bookVersion > 1_000_000_000) {
    return { state: "UNVERIFIED_BOOK", detail:
      "The saved price-book identity or revision version cannot be verified. Reload Settings; do not submit a replacement." };
  }
  return { state: "READY_FOR_OWNER_REVIEW", version: target.bookVersion,
    branchName: matches[0].name };
}
