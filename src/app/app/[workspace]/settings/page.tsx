import { OperationalRoute } from "@/features/operations/OperationalRoute";
import { OwnerSettingsPreview } from "@/features/settings/OwnerSettingsPreview";

export default async function StaffSettingsPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;

  return (
    <>
      <OperationalRoute
        surface="staff"
        workspaceLabel={workspace}
        title="Team, services, policies and integrations settings."
        description="Owner-controlled settings expose roles, invite state, service catalog, areas, policies and reconnect/test states without showing secrets."
      />
      <OwnerSettingsPreview />
    </>
  );
}
