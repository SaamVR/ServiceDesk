import { OperationalProductRoute } from "@/features/operations/OperationalProductRoute";

export default async function StaffAiStudioPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  return <OperationalProductRoute workspaceSlug={workspace} module="ai-studio" />;
}
