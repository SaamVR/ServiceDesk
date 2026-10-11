import { MarketingShell } from "@/components/shell/MarketingShell";
import { ownerRegistrationAvailable } from "@/features/auth/owner-registration-readiness";
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
  const canRegister = ownerRegistrationAvailable();
  return (
    <MarketingShell
      title="Run cleaning operations from enquiry to paid job."
      description="ServiceDesk AI connects customer intake, quoting, scheduling, crew execution, payments, quality and recovery in one operational workspace for residential cleaning teams."
      primaryHref={canRegister ? "/auth/sign-up" : "/tour"}
      primaryLabel={canRegister ? "Create your workspace" : "Explore product tour"}
      secondaryHref={canRegister ? "/tour" : "/features"}
      secondaryLabel={canRegister ? "Explore the product" : "View product features"}
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
