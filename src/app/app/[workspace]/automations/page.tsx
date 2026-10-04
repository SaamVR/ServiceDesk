import { OperationalRoute } from "@/features/operations/OperationalRoute";
import { RecoveryActionsPreview } from "@/features/recovery/RecoveryActionsPreview";

export default async function StaffAutomationsPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;

  return (
    <>
      <OperationalRoute
        surface="staff"
        workspaceLabel={workspace}
        title="Automation status with delivery evidence."
        description="Built-in follow-up, reminder, balance and feedback rules show queue state, retry state, quiet-hour suppression and dead-letter recovery."
      />
      <RecoveryActionsPreview />
    </>
  );
}
