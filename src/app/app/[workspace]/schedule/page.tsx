import { OperationalRoute } from "@/features/operations/OperationalRoute";

export default async function StaffSchedulePage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;

  return (
    <OperationalRoute
      surface="staff"
      workspaceLabel={workspace}
      title="Crew schedule with freshness and conflict reasons."
      description="Schedule lanes explain service duration, buffer, crew eligibility, stale Calendar data and external-busy conflicts before confirming a slot."
    />
  );
}
