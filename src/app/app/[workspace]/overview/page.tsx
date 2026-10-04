import { OperationalFixtureRoute } from "@/features/operations/OperationalFixtureRoute";

export default async function StaffOverviewPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;

  return (
    <OperationalFixtureRoute
      surface="staff"
      staffModule="overview"
      workspaceLabel={workspace}
      title="Staff attention overview."
      description="Attention queue and next actions are derived from injected DTO snapshots."
    />
  );
}
