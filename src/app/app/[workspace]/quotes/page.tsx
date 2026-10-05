import { OperationalProductRoute } from "@/features/operations/OperationalProductRoute";

export default async function StaffQuotesPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const { workspace } = await params;
  const query = await searchParams;
  return (
    <OperationalProductRoute
      workspaceSlug={workspace}
      module="quotes"
      notice={query.notice}
      error={query.error}
    />
  );
}
