import { OperationalFixtureRoute } from "@/features/operations/OperationalFixtureRoute";

export default function CrewTodayPage() {
  return (
    <OperationalFixtureRoute
      surface="crew"
      crewModule="today"
      workspaceLabel="Crew workspace"
      title="Today list for assigned cleaning visits."
      description="Crew sees assigned jobs only, with network-required V1 status and a safe path into the job detail workflow."
    />
  );
}
