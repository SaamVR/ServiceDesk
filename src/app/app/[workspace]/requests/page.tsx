import { OperationalProductRoute } from "@/features/operations/OperationalProductRoute";

export default async function StaffRequestsPage({ params, searchParams }: { params: Promise<{ workspace: string }>; searchParams: Promise<{ notice?: string; error?: string; request?: string; search?: string }> }) {
  const { workspace } = await params;
  const query = await searchParams;
  return <OperationalProductRoute workspaceSlug={workspace} module="requests" selectedRequestId={query.request} searchQuery={query.search} notice={query.notice} error={query.error} />;
}
