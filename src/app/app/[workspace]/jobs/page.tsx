import { OperationalRoute } from "@/features/operations/OperationalRoute";

export default async function StaffJobsPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;

  return (
    <OperationalRoute
      surface="staff"
      workspaceLabel={workspace}
      title="Jobs from assignment to completion review."
      description="Job cards expose crew status, checklist state, photo/time/material proof, incident state and review before balance invoice creation."
    />
  );
}
