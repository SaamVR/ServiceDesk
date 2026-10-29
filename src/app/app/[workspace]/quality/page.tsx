import { OperationalProductRoute } from "@/features/operations/OperationalProductRoute";
import { QualityCaseFollowthroughPanel } from "@/features/operations/QualityCaseFollowthroughPanel";

export default async function StaffQualityPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string }>;
  searchParams: Promise<{ case?: string; queue?: string; q?: string; notice?: string; error?: string }>;
}) {
  const { workspace } = await params;
  const query = await searchParams;
  return (
    <>
    <OperationalProductRoute
      workspaceSlug={workspace}
      module="quality"
      selectedQualityCaseId={query.case}
      selectedQualityQueue={query.queue}
      qualitySearchQuery={query.q}
      notice={query.notice}
      error={query.error}
    />
    <QualityCaseFollowthroughPanel workspaceSlug={workspace} selectedCaseId={query.case}/>
    </>
  );
}
