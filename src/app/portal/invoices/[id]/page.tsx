import { CustomerProductRoute } from "@/features/operations/CustomerProductRoute";

export default async function PortalInvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  return <CustomerProductRoute module="invoice" resourceId={id} notice={query.notice} error={query.error} />;
}
