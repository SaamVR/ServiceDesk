import { OperationalFixtureRoute } from "@/features/operations/OperationalFixtureRoute";

export default async function StaffQualityPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;

  return (
    <OperationalFixtureRoute
      surface="staff"
      staffModule="quality"
      workspaceLabel={workspace}
      title="Quality review workspace."
      description="Customer reviews and quality actions remain disabled until accepted server commands exist."
    />
  );
}
