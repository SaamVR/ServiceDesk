import { OperationalRoute } from "@/features/operations/OperationalRoute";

export default async function PortalQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <OperationalRoute
      surface="customer"
      resourceLabel={`quote ${id}`}
      title="Review the current quote version before accepting."
      description="Quote acceptance targets the exact current version. Superseded or expired quote states must ask for a new version instead of silently accepting."
    />
  );
}
