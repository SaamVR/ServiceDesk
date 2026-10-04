import { OperationalFixtureRoute } from "@/features/operations/OperationalFixtureRoute";

export default async function StaffSettingsPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;

  return (
    <OperationalFixtureRoute
      surface="staff"
      staffModule="settings"
      workspaceLabel={workspace}
      title="Owner settings workspace."
      description="Settings changes remain preview-only until accepted server commands exist."
    />
  );
}
