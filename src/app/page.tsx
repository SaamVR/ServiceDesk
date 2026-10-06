import { MarketingShell } from "@/components/shell/MarketingShell";
import {
  BenefitGrid,
  CustomerJourneyPreview,
  CrewWorkspacePreview,
  PricingControlCard,
  IntegrationStatusGrid,
  LifecycleProof,
  StaffWorkspacePreview,
} from "@/features/product/ProductSections";

export default function HomePage() {
  return (
    <MarketingShell
      title="Run cleaning operations from enquiry to paid job."
      description="ServiceDesk AI connects customer intake, quoting, scheduling, crew execution, payments, quality and recovery in one operational workspace for residential cleaning teams."
    >
      <BenefitGrid />
      <LifecycleProof />
      <PricingControlCard />
      <CustomerJourneyPreview />
      <StaffWorkspacePreview />
      <CrewWorkspacePreview />
      <IntegrationStatusGrid />
    </MarketingShell>
  );
}
