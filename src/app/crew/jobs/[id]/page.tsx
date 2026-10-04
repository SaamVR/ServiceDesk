import { OperationalFixtureRoute } from "@/features/operations/OperationalFixtureRoute";

export default async function CrewJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <OperationalFixtureRoute
      surface="crew"
      crewModule="job"
      workspaceLabel="Crew workspace"
      resourceLabel={`visit ${id}`}
      title="Crew job detail and field evidence boundary."
      description="Crew mutations remain disabled until the accepted visit transition and field evidence persistence commands exist."
    />
  );
}
