import { OperationalProductRoute } from "@/features/operations/OperationalProductRoute";

export default async function StaffQualityPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string }>;
  searchParams: Promise<{ case?: string; notice?: string; error?: string }>;
}) {
  const { workspace } = await params;
  const query = await searchParams;
  return (
    <OperationalProductRoute
      workspaceSlug={workspace}
      module="quality"
      selectedQualityCaseId={query.case}
      notice={query.notice}
      error={query.error}
    />
  );
}
