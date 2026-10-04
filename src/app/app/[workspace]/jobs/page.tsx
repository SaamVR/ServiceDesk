import { OperationalFixtureRoute } from "@/features/operations/OperationalFixtureRoute";

export default async function StaffJobsPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;

  return (
    <OperationalFixtureRoute
      surface="staff"
      staffModule="jobs"
      workspaceLabel={workspace}
      title="Visit jobs workspace."
      description="Staff assignment and transitions remain server-authorized and disabled in fixture mode."
    />
  );
}
