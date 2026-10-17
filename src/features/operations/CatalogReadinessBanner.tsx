import Link from "next/link";
import { FeedbackBanner } from "@/components/product/FeedbackPrimitives";
import { buildStaffModuleHref } from "./staff-modules";
import type { OperationalBranchScope, OperationalServiceCatalogItem } from "./operational-product-runtime";
import { availableFirstRunUsdBranches, countQuoteableCleaningServices, type OwnerPricingBookProof } from "./owner-pricing-readiness";

/**
 * Read-only owner commercial readiness. Active services alone cannot establish
 * that a branch has the persisted price book required for real customer quotes.
 * Unknown or denied proof is NEVER presented as a successful verification.
 */
export function CatalogReadinessBanner({
  workspaceSlug,
  serviceCatalog,
  branchScope,
  ownerPricingBookProof,
}: {
  workspaceSlug: string;
  serviceCatalog?: readonly OperationalServiceCatalogItem[];
  branchScope?: OperationalBranchScope;
  ownerPricingBookProof?: OwnerPricingBookProof;
}) {
  if (!serviceCatalog) return null;

  const settingsHref = buildStaffModuleHref(workspaceSlug, "settings");
  const settingsLink = <Link className="app-button-secondary"
    href={settingsHref}>Review service setup</Link>;
  const canStartRates = availableFirstRunUsdBranches(branchScope, ownerPricingBookProof).length > 0;
  const rateSetupLink = canStartRates ? <Link className="app-button-secondary"
    href={settingsHref + "#owner-first-run-pricing"}>Enter actual branch rates</Link>
    : settingsLink;

  if (countQuoteableCleaningServices(serviceCatalog) === 0) {
    return (
      <FeedbackBanner
        title="Quoting setup incomplete · no active cleaning service"
        description="No active Standard, Deep or Move-Out cleaning service was verified in this saved catalog. Unrelated active services do not establish cleaning quote readiness. Customer enquiries may be recorded, but an authorized owner must configure supported services and real branch pricing before issuing quotes."
        tone="warning"
        action={rateSetupLink}
      />
    );
  }

  // This proof exists only on verified owner snapshots, never on a customer or
  // unauthorized user surface. Do not guess pricing readiness for other roles.
  if (!ownerPricingBookProof) return null;
  if (ownerPricingBookProof.state === "UNAVAILABLE") {
    return (
      <FeedbackBanner
        title="Branch pricing readiness could not be verified"
        description="The saved branch price books could not be checked from this owner session. This is not proof that real customer quotes are ready. Refresh and verify pricing in Settings before quoting."
        tone="warning"
        action={settingsLink}
      />
    );
  }

  const unconfigured = availableFirstRunUsdBranches(branchScope, ownerPricingBookProof);
  if (unconfigured.length === 0) return null;
  return (
    <FeedbackBanner
      title="Quoting setup incomplete · branch pricing"
      description={unconfigured.length === 1
        ? `The USD branch “${unconfigured[0].name}” has no verified active branch price book. An authorized owner must configure its actual rates before treating its customer quotes as ready. Other branches may already be configured.`
        : `${unconfigured.length} USD branches in this owner view have no verified active branch price book. An authorized owner must configure actual rates before treating quotes for those branches as ready. Other branches may already be configured.`}
      tone="warning"
      action={rateSetupLink}
    />
  );
}
