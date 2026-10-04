import { OperationalFixtureRoute } from "@/features/operations/OperationalFixtureRoute";

export default async function PortalQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <OperationalFixtureRoute
      surface="customer"
      customerModule="quote"
      resourceLabel={`quote ${id}`}
      title="Quote detail and acceptance boundary."
      description="Quote acceptance must target the exact server version and remains disabled in fixture mode."
    />
  );
}
