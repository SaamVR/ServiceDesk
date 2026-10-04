import { OperationalRoute } from "@/features/operations/OperationalRoute";

export default function OnboardingPage() {
  return (
    <OperationalRoute
      surface="onboarding"
      workspaceLabel="ServiceDesk setup"
      title="Owner setup for services, areas, team, policies and integrations."
      description="Onboarding shows readiness without hiding provider setup blockers. Live messaging, Calendar and payment modes require controlled proof before release."
    />
  );
}
