import { StaffOverviewDashboard } from "@/features/operations/StaffOverviewDashboard";
import { loadOperationalStaffSnapshot } from "@/features/operations/operational-product-runtime";

export default async function StaffOverviewPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;
  const result = await loadOperationalStaffSnapshot(workspace);

  return (
    <StaffOverviewDashboard
      workspace={workspace}
      snapshot={result.ok ? result.value : undefined}
      errorMessage={result.ok ? undefined : result.message}
    />
  );
}
