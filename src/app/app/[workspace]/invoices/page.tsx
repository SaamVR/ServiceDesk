import { OperationalProductRoute } from "@/features/operations/OperationalProductRoute";

export default async function StaffInvoicesPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string }>;
  searchParams: Promise<{ notice?: string; error?: string; invoice?: string }>;
}) {
  const { workspace } = await params;
  const query = await searchParams;
  return (
    <OperationalProductRoute
      workspaceSlug={workspace}
      module="invoices"
      selectedInvoiceId={query.invoice}
      notice={query.notice}
      error={query.error}
    />
  );
}
