import { OperationalRoute } from "@/features/operations/OperationalRoute";

export default async function StaffQuotesPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;

  return (
    <OperationalRoute
      surface="staff"
        staffModule="quotes"
      workspaceLabel={workspace}
      title="Quotes, approvals and version changes."
      description="Dispatcher review surfaces policy exceptions, deterministic price snapshots, validity, acceptance version and request-change state."
    />
  );
}
