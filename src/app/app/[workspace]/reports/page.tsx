import { OperationalProductRoute } from "@/features/operations/OperationalProductRoute";

export default async function StaffReportsPage({
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
      module="reports"
      notice={query.notice}
      error={query.error}
    />
  );
}
