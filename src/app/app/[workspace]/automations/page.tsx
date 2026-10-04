import { OperationalFixtureRoute } from "@/features/operations/OperationalFixtureRoute";

export default async function StaffAutomationsPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;

  return (
    <OperationalFixtureRoute
      surface="staff"
      staffModule="automations"
      workspaceLabel={workspace}
      title="Automation recovery queue."
      description="Recovery actions remain preview-only until durable commands and provider evidence exist."
    />
  );
}
