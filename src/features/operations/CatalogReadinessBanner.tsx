import Link from "next/link";
import { FeedbackBanner } from "@/components/product/FeedbackPrimitives";
import { buildStaffModuleHref } from "./staff-modules";
import type { OperationalBranchScope, OperationalServiceCatalogItem } from "./operational-product-runtime";
import { availableFirstRunUsdBranches, type OwnerPricingBookProof } from "./owner-pricing-readiness";

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

  const settingsLink = <Link className="app-button-secondary"
    href={buildStaffModuleHref(workspaceSlug, "settings")}>Review service setup</Link>;

  if (!serviceCatalog.some(item => item.active)) {
    return (
      <FeedbackBanner
        title="Quoting setup incomplete · no active cleaning service"
        description="This workspace has no active service in its saved catalog. Customer enquiries can be recorded, but a priced quote cannot be treated as operationally ready until an authorized owner configures services and pricing. No sample price or provider status is being invented."
        tone="warning"
        action={settingsLink}
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
      action={settingsLink}
    />
  );
}
