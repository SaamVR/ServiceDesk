import { OperationalProductRoute } from "@/features/operations/OperationalProductRoute";
import { F20OwnerSourceReviewGate } from "@/features/operations/F20OwnerSourceReviewGate";

export default async function StaffCustomersPage({ params, searchParams }: { params: Promise<{ workspace: string }>; searchParams: Promise<{ notice?: string; error?: string; customer?: string; search?: string }> }) {
  const { workspace } = await params;
  const query = await searchParams;
  return <><OperationalProductRoute workspaceSlug={workspace} module="customers" selectedCustomerId={query.customer} searchQuery={query.search} notice={query.notice} error={query.error} /><F20OwnerSourceReviewGate workspaceSlug={workspace} surface="customers"/></>;
}
