import { OperationalFixtureRoute } from "@/features/operations/OperationalFixtureRoute";

export default async function StaffBillingPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;

  return (
    <OperationalFixtureRoute
      surface="staff"
      staffModule="billing"
      workspaceLabel={workspace}
      title="Platform billing and usage."
      description="Billing data remains snapshot-driven and does not mutate plan state from Product."
    />
  );
}
