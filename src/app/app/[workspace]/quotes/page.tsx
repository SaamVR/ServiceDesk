import { OperationalFixtureRoute } from "@/features/operations/OperationalFixtureRoute";

export default async function StaffQuotesPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;

  return (
    <OperationalFixtureRoute
      surface="staff"
      staffModule="quotes"
      workspaceLabel={workspace}
      title="Quote approval workspace."
      description="Quote send uses an injected sendQuote adapter and remains disabled until wired to accepted entrypoints."
    />
  );
}
