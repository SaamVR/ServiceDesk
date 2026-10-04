import { OperationalRoute } from "@/features/operations/OperationalRoute";

export default function PortalPropertiesPage() {
  return (
    <OperationalRoute
      surface="customer"
      resourceLabel="properties"
      title="Manage cleaning properties and access notes."
      description="Property records, contacts and preferences remain customer-scoped and require verified identity before sensitive account actions."
    />
  );
}
