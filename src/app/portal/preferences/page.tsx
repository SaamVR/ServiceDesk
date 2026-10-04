import { OperationalFixtureRoute } from "@/features/operations/OperationalFixtureRoute";

export default function PortalPreferencesPage() {
  return (
    <OperationalFixtureRoute
      surface="customer"
      customerModule="preferences"
      title="Communication preferences."
      description="Preference changes remain preview-only until the accepted customer portal command boundary exists."
    />
  );
}
