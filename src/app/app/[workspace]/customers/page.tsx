import { OperationalRoute } from "@/features/operations/OperationalRoute";

export default async function StaffCustomersPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;

  return (
    <OperationalRoute
      surface="staff"
      workspaceLabel={workspace}
      title="CRM for customers, properties, contacts and consent."
      description="Staff can search customers and review possible duplicates while server-side membership and workspace checks remain authoritative."
    />
  );
}
