import { CustomerProductRoute } from "@/features/operations/CustomerProductRoute";

export default async function PortalPreferencesPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const query = await searchParams;
  return <CustomerProductRoute module="preferences" notice={query.notice} error={query.error} />;
}
