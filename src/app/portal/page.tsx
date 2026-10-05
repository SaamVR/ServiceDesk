import { CustomerProductRoute } from "@/features/operations/CustomerProductRoute";

export default async function PortalPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const query = await searchParams;
  return <CustomerProductRoute module="overview" notice={query.notice} error={query.error} />;
}
