import { StaffOverviewDashboard } from "@/features/operations/StaffOverviewDashboard";
import { BranchContextBar } from "@/features/operations/BranchContextBar";
import { loadOperationalStaffSnapshot } from "@/features/operations/operational-product-runtime";

export default async function StaffOverviewPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;
  const result = await loadOperationalStaffSnapshot(workspace);

  return (
    <>
      {result.ok ? (
        <BranchContextBar
          workspaceSlug={workspace}
          currentModule="overview"
          branchScope={result.value.branchScope}
        />
      ) : null}
      <StaffOverviewDashboard
        workspace={workspace}
        snapshot={result.ok ? result.value : undefined}
        errorMessage={result.ok ? undefined : result.message}
      />
    </>
  );
}
