import { OperationalRoute } from "@/features/operations/OperationalRoute";

export default function PortalPreferencesPage() {
  return (
    <OperationalRoute
      surface="customer"
      customerModule="preferences"
      resourceLabel="preferences"
      title="Manage communication preferences and consent."
      description="Customers can see preferred channel, consent and provider availability without turning fixture messaging into live provider proof."
    />
  );
}
