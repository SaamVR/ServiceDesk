import { StaffOverviewDashboard } from "@/features/operations/StaffOverviewDashboard";

export default async function StaffOverviewPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;

  return <StaffOverviewDashboard workspace={workspace} />;
}
