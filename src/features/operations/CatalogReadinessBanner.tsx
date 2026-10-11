import Link from "next/link";
import { FeedbackBanner } from "@/components/product/FeedbackPrimitives";
import { buildStaffModuleHref } from "./staff-modules";
import type { OperationalServiceCatalogItem } from "./operational-product-runtime";

/**
 * Read-only operational truth. A saved customer enquiry is not a quotable job
 * when the workspace has no active service offering. The notice does not
 * pretend Settings can auto-provision rate books or execute any business action.
 */
export function CatalogReadinessBanner({
  workspaceSlug,
  serviceCatalog,
}: {
  workspaceSlug: string;
  serviceCatalog?: readonly OperationalServiceCatalogItem[];
}) {
  if (!serviceCatalog || serviceCatalog.some(item => item.active)) return null;
  return (
    <FeedbackBanner
      title="Quoting setup incomplete · no active cleaning service"
      description="This workspace has no active service in its saved catalog. Customer enquiries can be recorded, but a priced quote cannot be treated as operationally ready until an authorized owner configures services and pricing. No sample price or provider status is being invented."
      tone="warning"
      action={<Link className="app-button-secondary" href={buildStaffModuleHref(workspaceSlug, "settings")}>Review service setup</Link>}
    />
  );
}
