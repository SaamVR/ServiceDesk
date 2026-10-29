import type {
  OperationalBranchScope,
  OperationalRequest,
} from "./operational-product-runtime";

export type QuotePriceReadiness =
  | { state: "VERIFIED"; branchId: string; message: string }
  | { state: "OWNER_SETUP_REQUIRED" | "EVIDENCE_UNAVAILABLE" | "BRANCH_UNRESOLVED" | "SERVER_VALIDATION_REQUIRED"; message: string };

/** Never substitute active service/room counts for an actual saved rate card.
 * Staff without owner-only rate proofs retain their server-validated quote
 * action; owners get a precise local warning instead of a false success CTA. */
export function quotePriceReadiness(input: {
  request: Pick<OperationalRequest, "branchId">;
  actorRole: string;
  branchScope?: OperationalBranchScope;
  ownerPricingBookProof?: {
    state: "VERIFIED" | "UNAVAILABLE";
    activeBranchIds: string[];
    existingBookBranchIds?: string[];
  };
}): QuotePriceReadiness {
  if (input.actorRole !== "OWNER") {
    return {
      state: "SERVER_VALIDATION_REQUIRED",
      message: "Authorized quote calculation checks saved branch prices on the server before creating a quote.",
    };
  }
  const proof = input.ownerPricingBookProof;
  const scope = input.branchScope;
  if (!proof || proof.state !== "VERIFIED" ||
      !Array.isArray(proof.activeBranchIds) ||
      !Array.isArray(proof.existingBookBranchIds) ||
      !scope || scope.mode === "LEGACY" ||
      !Array.isArray(scope.branches) || scope.branches.length === 0) {
    return {
      state: "EVIDENCE_UNAVAILABLE",
      message: "Authorized branch and independent saved price-book evidence are unavailable. Reload owner Settings before calculating.",
    };
  }
  // A VERIFIED label cannot replace actual saved inventory; active priced
  // branch IDs must be backed by an existing price book and authorized scope.
  const known = new Set(scope.branches.map(branch => branch.id));
  if (proof.existingBookBranchIds.some(id => !known.has(id)) ||
      proof.activeBranchIds.some(id =>
        !known.has(id) || !proof.existingBookBranchIds?.includes(id))) {
    return {
      state: "EVIDENCE_UNAVAILABLE",
      message: "Saved pricing inventory contradicts authorized branches or active price-book evidence. Refresh Settings before calculating.",
    };
  }
  // Never guess a quote branch from the ONLY price book or from a selected
  // staff view. The actual persisted request must identify that branch.
  const candidate = typeof input.request.branchId === "string"
    ? input.request.branchId.trim() : "";
  if (!candidate) {
    return {
      state: "BRANCH_UNRESOLVED",
      message: "This saved request has no explicit branch. Assign its authorized service branch before calculating a quote.",
    };
  }
  const authorized = scope.branches.find(branch => branch.id === candidate &&
    (scope.mode !== "BRANCH" || scope.selectedBranchId === candidate));
  if (!authorized) {
    return {
      state: "BRANCH_UNRESOLVED",
      message: "The request branch is outside the authorized owner view. Choose an authorized request branch before calculating.",
    };
  }
  if (authorized.currency !== "USD") {
    return {
      state: "OWNER_SETUP_REQUIRED",
      message: "The request branch is not configured for supported USD cleaning quote pricing. Review its currency and real saved rates.",
    };
  }
  if (!proof.activeBranchIds.includes(candidate)) {
    return {
      state: "OWNER_SETUP_REQUIRED",
      message: "This request branch has no independently verified active USD price book. Review its real saved rates in Settings.",
    };
  }
  return {
    state: "VERIFIED", branchId: candidate,
    message: "Verified saved branch pricing found. The quote server still validates current rates before saving.",
  };
}
