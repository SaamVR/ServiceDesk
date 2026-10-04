import { MarketingShell } from "@/components/shell/MarketingShell";
import {
  CustomerJourneyPreview,
  FixturePricingCard,
  IntegrationStatusGrid,
  LifecycleProof,
  TourScenarioList,
} from "./ProductSections";

const copy = {
  features: {
    title: "Operational features for a real cleaning desk.",
    description: "Customer intake, CRM, quote approvals, scheduling, job execution, collections, recurrence, quality cases, reporting and integration health live as app routes rather than a gallery.",
  },
  integrations: {
    title: "Provider integrations with visible proof boundaries.",
    description: "WhatsApp, Google Calendar, payments, email, webhooks and AI are shown with explicit configuration, degraded and blocked states. Provider receipts are not claimed until Chat 2 verifies them.",
  },
  cleaning: {
    title: "Built first for residential cleaning teams.",
    description: "ServiceDesk AI V1 supports owners, dispatchers, crews and customers through a cleaning-specific lifecycle before expanding to unrelated trades in V2.",
  },
  pricing: {
    title: "Pricing is configured, snapshotted and auditable.",
    description: "The UI explains plan/contact status without invented market prices. Cleaning quotes use deterministic rate cards and versioned snapshots from the core facade.",
  },
  help: {
    title: "Help that explains what the product can actually do.",
    description: "Help content focuses on setup, roles, provider status, quote states, delivery uncertainty and safe recovery instead of unsupported automation promises.",
  },
  contact: {
    title: "Book a walkthrough when the operational route is ready to review.",
    description: "The product can be reviewed through the tour and presentation routes. Live provider setup remains an owner-controlled release gate.",
  },
  privacy: {
    title: "Privacy baseline for tenant-scoped cleaning operations.",
    description: "Customer, property, attachment, payment and provider records must remain workspace scoped. UI role previews do not grant authorization.",
  },
  terms: {
    title: "Terms baseline for an evidence-led V1.",
    description: "No testimonial, uptime, compliance, paid receipt or live provider claim is published without evidence. Configuration-blocked release states stay visible.",
  },
} as const;

export type StaticProductPageKind = keyof typeof copy;

export function StaticProductPage({ kind }: { kind: StaticProductPageKind }) {
  const page = copy[kind];

  return (
    <MarketingShell title={page.title} description={page.description}>
      {kind === "features" && <LifecycleProof />}
      {kind === "integrations" && <IntegrationStatusGrid />}
      {kind === "cleaning" && <CustomerJourneyPreview />}
      {kind === "pricing" && <FixturePricingCard />}
      {(kind === "help" || kind === "contact") && <TourScenarioList />}
      {(kind === "privacy" || kind === "terms") && (
        <section className="section-card">
          <p className="eyebrow">Evidence and authorization boundary</p>
          <h2>Safe product language until verification.</h2>
          <p>
            This route is product UI copy, not legal advice. Final legal text, live provider claims,
            receipts and business identity must be approved before production release.
          </p>
        </section>
      )}
    </MarketingShell>
  );
}
