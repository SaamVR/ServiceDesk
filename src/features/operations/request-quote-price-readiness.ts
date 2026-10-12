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
  ownerPricingBookProof?: { state: "VERIFIED" | "UNAVAILABLE"; activeBranchIds: string[] };
}): QuotePriceReadiness {
  if (input.actorRole !== "OWNER") {
    return {
      state: "SERVER_VALIDATION_REQUIRED",
      message: "Authorized quote calculation checks saved branch prices on the server before creating a quote.",
    };
  }
  const proof = input.ownerPricingBookProof;
  if (!proof || proof.state !== "VERIFIED" || !Array.isArray(proof.activeBranchIds)) {
    return {
      state: "EVIDENCE_UNAVAILABLE",
      message: "Saved price-book evidence is unavailable. Reopen Settings and verify pricing before calculating.",
    };
  }
  if (proof.activeBranchIds.length === 0) {
    return {
      state: "OWNER_SETUP_REQUIRED",
      message: "No active, effective USD cleaning price has been verified. Configure real branch pricing in Settings.",
    };
  }
  const selectedBranch = input.request.branchId ||
    (input.branchScope?.mode === "BRANCH" ? input.branchScope.selectedBranchId : undefined);
  const candidate = selectedBranch ??
    (proof.activeBranchIds.length === 1 ? proof.activeBranchIds[0] : undefined);
  if (!candidate) {
    return {
      state: "BRANCH_UNRESOLVED",
      message: "Select a request branch with verified pricing before calculating a quote.",
    };
  }
  if (!proof.activeBranchIds.includes(candidate)) {
    return {
      state: "OWNER_SETUP_REQUIRED",
      message: "The request's branch has no verified active USD price book. Review its saved rates in Settings.",
    };
  }
  return {
    state: "VERIFIED", branchId: candidate,
    message: "Verified saved branch pricing found. The quote server still validates current rates before saving.",
  };
}
