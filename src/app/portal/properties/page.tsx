import { CustomerProductRoute } from "@/features/operations/CustomerProductRoute";

export default async function PortalPropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const query = await searchParams;
  return <CustomerProductRoute module="properties" notice={query.notice} error={query.error} />;
}
