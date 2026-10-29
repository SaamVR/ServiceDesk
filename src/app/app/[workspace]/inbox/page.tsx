import { InboxConsentedDraftPanel } from "@/features/operations/InboxConsentedDraftPanel";
import { InboxProtectedLeadReviewPanel } from "@/features/operations/InboxProtectedLeadReviewPanel";
import { OperationalProductRoute } from "@/features/operations/OperationalProductRoute";

export default async function StaffInboxPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string }>;
  searchParams: Promise<{ conversation?: string; queue?: string; search?: string; notice?: string; error?: string }>;
}) {
  const { workspace } = await params;
  const query = await searchParams;
  return (
    <>
    <OperationalProductRoute
      workspaceSlug={workspace}
      module="inbox"
      selectedConversationId={query.conversation}
      selectedQueue={query.queue}
      searchQuery={query.search}
      notice={query.notice}
      error={query.error}
    />
    <InboxConsentedDraftPanel workspaceSlug={workspace} selectedConversationId={query.conversation}/>
    <InboxProtectedLeadReviewPanel workspaceSlug={workspace} selectedConversationId={query.conversation}/>
    </>
  );
}
