import { MarketingShell } from "@/components/shell/MarketingShell";
import {
  BenefitGrid,
  CustomerJourneyPreview,
  CrewWorkspacePreview,
  FixturePricingCard,
  IntegrationStatusGrid,
  LifecycleProof,
  StaffWorkspacePreview,
} from "@/features/product/ProductSections";

export default function HomePage() {
  return (
    <MarketingShell
      title="Run cleaning enquiries, quotes, crews and payments from one operational workspace."
      description="ServiceDesk AI V1 is the working operations product for residential cleaning companies: customer intake, deterministic quotes, slot holds, deposit status, dispatch, crew proof, invoices and recovery states."
    >
      <BenefitGrid />
      <LifecycleProof />
      <FixturePricingCard />
      <CustomerJourneyPreview />
      <StaffWorkspacePreview />
      <CrewWorkspacePreview />
      <IntegrationStatusGrid />
    </MarketingShell>
  );
}
