import { OperationalRoute } from "@/features/operations/OperationalRoute";

export default function PortalPage() {
  return (
    <OperationalRoute
      surface="customer"
      title="Customer portal for properties, requests, quotes, visits and invoices."
      description="Customers see only their own scoped records: property details, current quote version, booking state, invoice balance and communication preferences."
    />
  );
}
