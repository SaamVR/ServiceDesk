import { OperationalFixtureRoute } from "@/features/operations/OperationalFixtureRoute";

export default async function StaffInvoicesPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;

  return (
    <OperationalFixtureRoute
      surface="staff"
      staffModule="invoices"
      workspaceLabel={workspace}
      title="Invoice ledger workspace."
      description="Manual collection and receipt state wait for accepted invoice/payment server boundaries."
    />
  );
}
