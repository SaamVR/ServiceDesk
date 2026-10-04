import { OperationalRoute } from "@/features/operations/OperationalRoute";

export default async function StaffReportsPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;

  return (
    <OperationalRoute
      surface="staff"
      workspaceLabel={workspace}
      title="Reports derived from stored operational records."
      description="Conversion, collection, capacity and contribution reporting labels missing cost data and never lets AI invent metrics."
    />
  );
}
