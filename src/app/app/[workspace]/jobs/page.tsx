import { OperationalProductRoute } from "@/features/operations/OperationalProductRoute";

export default async function StaffJobsPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string }>;
  searchParams: Promise<{ notice?: string; error?: string; job?: string; queue?: string; search?: string }>;
}) {
  const { workspace } = await params;
  const query = await searchParams;
  return (
    <OperationalProductRoute
      workspaceSlug={workspace}
      module="jobs"
      selectedJobId={query.job}
      selectedJobQueue={query.queue}
      searchQuery={query.search}
      notice={query.notice}
      error={query.error}
    />
  );
}
