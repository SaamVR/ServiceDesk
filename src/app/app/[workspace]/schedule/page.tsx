import { OperationalFixtureRoute } from "@/features/operations/OperationalFixtureRoute";

export default async function StaffSchedulePage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;

  return (
    <OperationalFixtureRoute
      surface="staff"
      staffModule="schedule"
      workspaceLabel={workspace}
      title="Schedule and capacity workspace."
      description="Find slots and hold slot use injected adapters and remain disabled until accepted server wiring exists."
    />
  );
}
