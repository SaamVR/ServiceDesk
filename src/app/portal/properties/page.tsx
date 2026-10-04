import { OperationalFixtureRoute } from "@/features/operations/OperationalFixtureRoute";

export default function PortalPropertiesPage() {
  return (
    <OperationalFixtureRoute
      surface="customer"
      customerModule="properties"
      title="Property and recurring service context."
      description="Property reads wait for accepted server snapshots before replacing fixture presentation data."
    />
  );
}
