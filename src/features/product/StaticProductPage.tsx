import { MarketingShell } from "@/components/shell/MarketingShell";
import {
  CustomerJourneyPreview,
  PricingControlCard,
  IntegrationStatusGrid,
  LifecycleProof,
} from "./ProductSections";

const copy = {
  features: {
    title: "Everything a cleaning operations team needs to move work forward.",
    description: "Customer intake, CRM, quoting, scheduling, field execution, collections, recurrence, quality, reporting and recovery live in one connected product workflow.",
  },
  integrations: {
    title: "Connect the systems your operation already uses.",
    description: "WhatsApp, Google Calendar, payments, email, webhooks and AI expose clear configuration, sandbox and verification states so operators always know what is ready for live use.",
  },
  cleaning: {
    title: "Built for residential cleaning operations.",
    description: "Owners, dispatchers, crews and customers share one cleaning-specific workflow from first enquiry through quote, booking, field proof, invoice and repeat service.",
  },
  pricing: {
    title: "Pricing stays rule-based, versioned and auditable.",
    description: "Cleaning quotes come from configured rate rules and versioned snapshots rather than AI-generated prices, so staff and customers see the same numbers.",
  },
  help: {
    title: "Help for the workflows your team uses every day.",
    description: "Guidance covers setup, roles, quote states, provider status, delivery uncertainty and safe recovery without promising unsupported automation.",
  },
  contact: {
    title: "See ServiceDesk against your real cleaning workflow.",
    description: "Review how enquiry intake, quoting, scheduling, dispatch, field work, payments and recovery fit together before deciding what to configure for launch.",
  },
  privacy: {
    title: "Privacy starts with workspace and role boundaries.",
    description: "Customer, property, attachment, payment and provider records stay scoped to the correct workspace, with access controlled by the signed-in role.",
  },
  terms: {
    title: "Clear product boundaries before launch.",
    description: "ServiceDesk keeps payment, provider and automation states explicit and does not publish live-service claims until the corresponding capability is verified.",
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
      {kind === "pricing" && <PricingControlCard />}
      {kind === "help" && (
        <section className="grid-section" aria-labelledby="help-topics-heading">
          <div className="section-heading">
            <p className="eyebrow">Support topics</p>
            <h2 id="help-topics-heading">Find the operational answer quickly.</h2>
          </div>
          <div className="card-grid three">
            <article className="plain-card"><h3>Getting started</h3><p>Workspace setup, roles, services and the first customer workflow.</p></article>
            <article className="plain-card"><h3>Daily operations</h3><p>Inbox, quotes, scheduling, jobs, invoices, quality and recovery queues.</p></article>
            <article className="plain-card"><h3>Connected services</h3><p>Understand configuration, sandbox and verification states for each provider.</p></article>
          </div>
        </section>
      )}
      {kind === "contact" && (
        <section className="section-card two-column" aria-labelledby="contact-next-step-heading">
          <div>
            <p className="eyebrow">Walkthrough preparation</p>
            <h2 id="contact-next-step-heading">Bring the workflow you want to improve.</h2>
            <p>Start with your current enquiry, quote, schedule, crew and payment process. ServiceDesk can then be evaluated against the handoffs and exceptions that matter to your operation.</p>
          </div>
          <div className="plain-card">
            <h3>Useful before a walkthrough</h3>
            <ul className="check-list">
              <li>Your core services and pricing rules</li>
              <li>How jobs are assigned and rescheduled</li>
              <li>Which customer channels your team uses</li>
              <li>Where payment or follow-up work gets stuck</li>
            </ul>
          </div>
        </section>
      )}
      {(kind === "privacy" || kind === "terms") && (
        <section className="section-card">
          <p className="eyebrow">Product policy</p>
          <h2>Tenant isolation and clear operational authority.</h2>
          <p>ServiceDesk keeps customer, property, payment and provider records scoped to a workspace and makes operator-controlled actions explicit. Final legal notices should match the deploying business entity and jurisdiction before public launch.</p>
        </section>
      )}
    </MarketingShell>
  );
}
