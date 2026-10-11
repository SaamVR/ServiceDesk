import { OperationalProductRoute } from "@/features/operations/OperationalProductRoute";

export default async function StaffSchedulePage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string }>;
  searchParams: Promise<{ queue?: string; from?: string; notice?: string; error?: string }>;
}) {
  const { workspace } = await params;
  const query = await searchParams;
  return (
    <OperationalProductRoute
      workspaceSlug={workspace}
      module="schedule"
      selectedScheduleQueue={query.queue}
      selectedScheduleFrom={query.from}
      notice={query.notice}
      error={query.error}
    />
  );
}
