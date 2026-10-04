import { OperationalFixtureRoute } from "@/features/operations/OperationalFixtureRoute";

export default async function PortalInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <OperationalFixtureRoute
      surface="customer"
      customerModule="invoice"
      resourceLabel={`invoice ${id}`}
      title="Invoice ledger and receipt boundary."
      description="Final receipt visibility is driven by authoritative invoice state, not a mocked checkout screen."
    />
  );
}
