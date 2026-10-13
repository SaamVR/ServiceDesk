import { OperationalProductRoute } from "@/features/operations/OperationalProductRoute";

export default async function StaffInboxPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string }>;
  searchParams: Promise<{ conversation?: string; queue?: string; notice?: string; error?: string }>;
}) {
  const { workspace } = await params;
  const query = await searchParams;
  return (
    <OperationalProductRoute
      workspaceSlug={workspace}
      module="inbox"
      selectedConversationId={query.conversation}
      selectedQueue={query.queue}
      notice={query.notice}
      error={query.error}
    />
  );
}
