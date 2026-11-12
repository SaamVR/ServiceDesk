import Link from "next/link";
import { OperationalProductRoute } from "@/features/operations/OperationalProductRoute";

export default async function StaffAutomationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string }>;
  searchParams: Promise<{ notice?: string; error?: string; template?: string }>;
}) {
  const { workspace } = await params;
  const query = await searchParams;
  return (
    <>
    <OperationalProductRoute
      workspaceSlug={workspace}
      module="automations"
      notice={query.notice}
      error={query.error}
      automationTemplate={query.template}
    />
    <section className="app-panel" aria-label="New owner workflow opportunity workbench">
      <h2>Find owner automation opportunities</h2>
      <p>Inspect double-checked saved workday signals and preview safe future-event internal rules. Existing records are not processed, and no model subscription is required.</p>
      <Link href={`/app/${encodeURIComponent(workspace)}/automations/opportunities`}>
        Review owner automation opportunities
      </Link>
    </section>
    </>
  );
}
