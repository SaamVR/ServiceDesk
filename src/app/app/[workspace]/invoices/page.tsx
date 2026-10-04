import { OperationalRoute } from "@/features/operations/OperationalRoute";

export default async function StaffInvoicesPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;

  return (
    <OperationalRoute
      surface="staff"
        staffModule="invoices"
      workspaceLabel={workspace}
      title="Invoices, allocations and collection attention."
      description="Staff sees deposit, balance, partial allocation, manual payment review, refund work and overdue reminder eligibility from stored ledger records."
    />
  );
}
