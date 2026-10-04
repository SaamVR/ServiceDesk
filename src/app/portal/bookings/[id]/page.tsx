import { OperationalFixtureRoute } from "@/features/operations/OperationalFixtureRoute";

export default async function PortalBookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <OperationalFixtureRoute
      surface="customer"
      customerModule="booking"
      resourceLabel={`booking ${id}`}
      title="Booking detail with slot, payment and visit state."
      description="Booking state stays fixture/sandbox-labelled until the verified payment bridge is complete."
    />
  );
}
