import { OperationalRoute } from "@/features/operations/OperationalRoute";

export default function CrewTodayPage() {
  return (
    <OperationalRoute
      surface="crew"
      workspaceLabel="Crew workspace"
      title="Today list for assigned cleaning visits."
      description="Crew sees assigned jobs only, with a prominent next status action and grouped checklist, proof, time/material and incident controls."
    />
  );
}
