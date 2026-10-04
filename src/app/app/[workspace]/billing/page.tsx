import { OperationalRoute } from "@/features/operations/OperationalRoute";

export default async function StaffBillingPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;

  return (
    <OperationalRoute
      surface="staff"
      workspaceLabel={workspace}
      title="Business billing and platform plan status."
      description="Platform subscription state stays separate from customer cleaning payments, invoices, refunds and receipts. Live payment mode requires eligibility proof."
    />
  );
}
