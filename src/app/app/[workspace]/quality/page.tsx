import { OperationalRoute } from "@/features/operations/OperationalRoute";

export default async function StaffQualityPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;

  return (
    <OperationalRoute
      surface="staff"
      staffModule="quality"
      workspaceLabel={workspace}
      title="Quality cases and recovery ownership."
      description="Feedback, issue owner, deadline, resolution state and optional review request are shown without pretending supervisor inspections exist in V1."
    />
  );
}
