import { OperationalFixtureRoute } from "@/features/operations/OperationalFixtureRoute";

export default async function StaffCustomersPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;

  return (
    <OperationalFixtureRoute
      surface="staff"
      staffModule="customers"
      workspaceLabel={workspace}
      title="Customer CRM workspace."
      description="Customer context is read from injected snapshots; Product does not create customer records directly."
    />
  );
}
