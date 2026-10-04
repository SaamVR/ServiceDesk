import { OperationalRoute } from "@/features/operations/OperationalRoute";

export default async function StaffOverviewPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;

  return (
    <OperationalRoute
      surface="staff"
      workspaceLabel={workspace}
      title="Overview starts with attention, not charts."
      description="Open approvals, stale calendar state, uncertain delivery and payment review are shown before metrics so dispatchers know the next action."
    />
  );
}
