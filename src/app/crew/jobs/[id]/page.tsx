import { OperationalRoute } from "@/features/operations/OperationalRoute";

export default async function CrewJobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <OperationalRoute
      surface="crew"
      crewModule="job"
      workspaceLabel="Crew workspace"
      resourceLabel={`job ${id}`}
      title="Job detail with progress actions and completion review."
      description="Checklist, photo evidence, time/material notes, incidents and completion review are visible without claiming offline sync in V1."
    />
  );
}
