import { QuoteRecoveryReadinessPanel } from "@/features/operations/QuoteRecoveryReadinessPanel";
import { OperationalProductRoute } from "@/features/operations/OperationalProductRoute";
import { OwnerQuoteCapacityHoldPanel } from "@/features/operations/OwnerQuoteCapacityHoldPanel";
import { OwnerQuoteHoldReleasePanel } from "@/features/operations/OwnerQuoteHoldReleasePanel";

export default async function StaffQuotesPage({ params, searchParams }: { params: Promise<{ workspace: string }>; searchParams: Promise<{ notice?: string; error?: string; quote?: string; search?: string }> }) {
  const { workspace } = await params;
  const query = await searchParams;
  return <><OperationalProductRoute workspaceSlug={workspace} module="quotes" selectedQuoteId={query.quote} searchQuery={query.search} notice={query.notice} error={query.error} /><QuoteRecoveryReadinessPanel workspaceSlug={workspace} selectedQuoteId={query.quote}/><OwnerQuoteCapacityHoldPanel workspaceSlug={workspace} selectedQuoteId={query.quote}/><OwnerQuoteHoldReleasePanel workspaceSlug={workspace} selectedQuoteId={query.quote}/></>;
}
