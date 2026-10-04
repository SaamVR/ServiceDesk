import { OperationalFixtureRoute } from "@/features/operations/OperationalFixtureRoute";

export default function PortalPage() {
  return (
    <OperationalFixtureRoute
      surface="customer"
      customerModule="overview"
      title="Customer portal for properties, requests, quotes, visits and invoices."
      description="Customers see only their own scoped records: property details, current quote version, booking state, invoice balance and communication preferences."
    />
  );
}
