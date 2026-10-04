import { OperationalFixtureRoute } from "@/features/operations/OperationalFixtureRoute";

export default function OnboardingPage() {
  return (
    <OperationalFixtureRoute
      surface="onboarding"
      workspaceLabel="BrightRoom Services"
      title="Onboarding readiness before go-live."
      description="Owner setup, provider readiness and policy checks are labelled as pending until configuration evidence exists."
    />
  );
}
