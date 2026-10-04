import { OperationalFixtureRoute } from "@/features/operations/OperationalFixtureRoute";

export default async function StaffReportsPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;

  return (
    <OperationalFixtureRoute
      surface="staff"
      staffModule="reports"
      workspaceLabel={workspace}
      title="Reporting workspace."
      description="Reports derive from supplied server records and must not infer missing business truth."
    />
  );
}
