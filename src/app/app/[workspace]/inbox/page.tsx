import { OperationalFixtureRoute } from "@/features/operations/OperationalFixtureRoute";

export default async function StaffInboxPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;

  return (
    <OperationalFixtureRoute
      surface="staff"
      staffModule="inbox"
      workspaceLabel={workspace}
      title="Shared inbox with handover and context."
      description="Desktop uses a thread list, conversation pane and customer/request context. Mobile opens one pane at a time without losing the resource URL."
    />
  );
}
