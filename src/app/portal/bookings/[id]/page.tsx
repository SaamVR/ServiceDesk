import { OperationalRoute } from "@/features/operations/OperationalRoute";

export default async function PortalBookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <OperationalRoute
      surface="customer"
      resourceLabel={`booking ${id}`}
      title="Track slot hold, visit confirmation and provider status separately."
      description="The booking route shows appointment state, payment state, Calendar freshness and message delivery as distinct records."
    />
  );
}
