import { OperationalRoute } from "@/features/operations/OperationalRoute";

export default async function PortalInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <OperationalRoute
      surface="customer"
      resourceLabel={`invoice ${id}`}
      title="See balance, allocations and next payment action."
      description="Invoice UI separates total, allocated payments, refunds and remaining balance. Payment receipts require verified callback evidence."
    />
  );
}
