import { OperationalFixtureRoute } from "@/features/operations/OperationalFixtureRoute";

export default async function StaffRequestsPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;

  return (
    <OperationalFixtureRoute
      surface="staff"
      staffModule="requests"
      workspaceLabel={workspace}
      title="Request summary workspace."
      description="Request edits remain disabled until create/update/calculateQuote commands are wired."
    />
  );
}
