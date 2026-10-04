import { OperationalRoute } from "@/features/operations/OperationalRoute";
import { QualityReviewPreview } from "@/features/quality/QualityReviewPreview";

export default async function StaffQualityPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;

  return (
    <>
      <OperationalRoute
        surface="staff"
        workspaceLabel={workspace}
        title="Quality cases and recovery ownership."
        description="Feedback, issue owner, deadline, resolution state and optional review request are shown without pretending supervisor inspections exist in V1."
      />
      <QualityReviewPreview />
    </>
  );
}
