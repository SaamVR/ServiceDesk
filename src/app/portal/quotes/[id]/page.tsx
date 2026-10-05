import { CustomerProductRoute } from "@/features/operations/CustomerProductRoute";

export default async function PortalQuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  return <CustomerProductRoute module="quote" resourceId={id} notice={query.notice} error={query.error} />;
}
