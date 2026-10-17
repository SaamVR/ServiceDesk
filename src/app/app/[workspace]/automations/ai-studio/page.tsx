import Link from "next/link";
import { PageHeader } from "@/components/product/PagePrimitives";
import { AiStudioWorkspace } from "@/features/operations/AiStudioWorkspace";
import { loadOperationalStaffSnapshot } from "@/features/operations/operational-product-runtime";
import { buildStaffModuleHref } from "@/features/operations/staff-modules";

/** The authenticated staff layout gates sign-in. The snapshot resolver must
 * independently verify active workspace membership and branch access before
 * AI Studio can render any protected saved-record selectors. */
export default async function StaffAiStudioPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  const result = await loadOperationalStaffSnapshot(workspace);
  return (
    <>
      <PageHeader eyebrow="Staff copilot workspace" title="AI Studio"
        description="Explore AI-assisted request and quote review with verified source records and explicit human approval." />
      {result.ok ? (
        <AiStudioWorkspace workspaceSlug={workspace} data={result.value} />
      ) : (
        <section className="app-panel" role="status"
          aria-label="AI Studio authorization and source availability">
          <h2>AI Studio records are unavailable</h2>
          <p>Your signed-in workspace and branch data could not be verified. No saved records or model controls are shown.</p>
          <Link href={buildStaffModuleHref(workspace, "automations")}>
            Return to AI &amp; Automation →
          </Link>
        </section>
      )}
    </>
  );
}
