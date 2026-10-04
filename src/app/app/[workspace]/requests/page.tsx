import { OperationalRoute } from "@/features/operations/OperationalRoute";

export default async function StaffRequestsPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;

  return (
    <OperationalRoute
      surface="staff"
        staffModule="requests"
      workspaceLabel={workspace}
      title="Requests move from collecting to quoted without losing history."
      description="The request view is a dedicated review surface for NEW, COLLECTING, READY, NEEDS_REVIEW, QUOTED, BOOKED, LOST and CLOSED states."
    />
  );
}
