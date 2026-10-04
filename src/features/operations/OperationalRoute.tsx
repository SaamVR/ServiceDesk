import { UIStateCard } from "@/components/shell/UIState";
import { PlatformBillingPreview } from "@/features/billing/PlatformBillingPreview";
import { CheckoutPreview } from "@/features/checkout/CheckoutPreview";
import { CrewJobPreview } from "@/features/crew/CrewJobPreview";
import { CrmPreview } from "@/features/crm/CrmPreview";
import { InboxPreview } from "@/features/inbox/InboxPreview";
import { ConnectorOperationsPreview } from "@/features/integrations/ConnectorOperationsPreview";
import { InvoiceLedgerPreview } from "@/features/invoices/InvoiceLedgerPreview";
import { OnboardingReadiness } from "@/features/onboarding/OnboardingReadiness";
import { CommunicationPreferences } from "@/features/preferences/CommunicationPreferences";
import { PropertyRecurringPreview } from "@/features/properties/PropertyRecurringPreview";
import {
  integrationCards,
  uiStateScenarios,
} from "@/features/product/story-model";
import { QualityReviewPreview } from "@/features/quality/QualityReviewPreview";
import { QuoteApprovalPreview } from "@/features/quotes/QuoteApprovalPreview";
import { RecoveryActionsPreview } from "@/features/recovery/RecoveryActionsPreview";
import { ReportsPreview } from "@/features/reports/ReportsPreview";
import { RequestSummaryPreview } from "@/features/request-intake/RequestSummaryPreview";
import { SchedulePreview } from "@/features/schedule/SchedulePreview";
import { OwnerSettingsPreview } from "@/features/settings/OwnerSettingsPreview";
import {
  buildCustomerModuleHref,
  customerModuleConfig,
  customerNavigation,
  type CustomerModule,
} from "./customer-modules";
import {
  buildStaffModuleHref,
  staffModuleConfig,
  staffNavigationGroups,
  type StaffModule,
} from "./staff-modules";
import {
  sampleAttentionItems,
  sampleConversation,
  sampleIntegrations,
  sampleInvoice,
  sampleQuote,
  sampleRequest,
  sampleSlot,
  sampleVisit,
} from "./sample-data";
import {
  buildCustomerPortalView,
  buildStaffQueueView,
} from "./view-models";

type Surface = "business" | "customer" | "staff" | "crew" | "onboarding" | "tour";

interface OperationalRouteProps {
  surface: Surface;
  title: string;
  description: string;
  workspaceLabel?: string;
  resourceLabel?: string;
  staffModule?: StaffModule;
  customerModule?: CustomerModule;
}

const surfaceNav: Record<Exclude<Surface, "staff" | "customer">, string[]> = {
  business: ["Services", "Areas", "FAQs", "Enquire", "Book"],
  crew: ["Today", "Job detail", "Checklist", "Proof", "Incident", "Completion"],
  onboarding: ["Business", "Services", "Team", "Policies", "Integrations", "Readiness"],
  tour: ["Scenario", "Command", "Receipt label", "Recovery", "Presentation"],
};

export function OperationalRoute({
  surface,
  title,
  description,
  workspaceLabel = "BrightRoom Services",
  resourceLabel,
  staffModule = "overview",
  customerModule = "overview",
}: OperationalRouteProps) {
  return (
    <main className="site-shell">
      <header className="site-header" aria-label={`${surface} workspace navigation`}>
        <a className="brand-lockup" href="/">
          <span className="brand-mark" aria-hidden="true">SD</span>
          <span>{workspaceLabel}</span>
        </a>
        {surface === "staff" ? (
          <nav className="site-nav grouped" aria-label="Staff workspace">
            {staffNavigationGroups.map((group) => (
              <div className="nav-group" key={group.label}>
                <span>{group.label}</span>
                {group.modules.map((module) => (
                  <a
                    aria-current={staffModule === module ? "page" : undefined}
                    href={buildStaffModuleHref(workspaceLabel, module)}
                    key={module}
                  >
                    {staffModuleConfig[module].label}
                  </a>
                ))}
              </div>
            ))}
          </nav>
        ) : surface === "customer" ? (
          <nav className="site-nav" aria-label="Customer portal">
            {customerNavigation.map((item) => (
              <a
                aria-current={customerModule === item.module ? "page" : undefined}
                href={buildCustomerModuleHref(item.module, {
                  quoteId: sampleQuote.id,
                  bookingId: sampleVisit.id,
                  invoiceId: sampleInvoice.id,
                })}
                key={item.module}
              >
                {item.label}
              </a>
            ))}
          </nav>
        ) : (
          <nav className="site-nav" aria-label="Workspace">
            {surfaceNav[surface].map((item) => <a href="#workspace" key={item}>{item}</a>)}
          </nav>
        )}
      </header>

      <section className="section-card" id="workspace">
        <div className="section-heading compact">
          <p className="eyebrow">{surface} route · {resourceLabel ?? "sample workspace"}</p>
          <h1>{title}</h1>
          <p className="lead">{description}</p>
        </div>
        {surface === "business" && <BusinessPanel />}
        {surface === "customer" && <CustomerPanel module={customerModule} />}
        {surface === "staff" && <StaffPanel module={staffModule} />}
        {surface === "crew" && <CrewPanel />}
        {surface === "onboarding" && <OnboardingPanel />}
        {surface === "tour" && <TourPanel />}
        <RouteStatePreview />
      </section>
    </main>
  );
}

function BusinessPanel() {
  return (
    <div className="hero-grid">
      <form className="plain-card" aria-label="Cleaning enquiry form">
        <h2>Start a cleaning request</h2>
        <label className="form-field">Service <input readOnly value="Move-out clean" /></label>
        <label className="form-field">Bedrooms <input readOnly value="3" /></label>
        <label className="form-field">Bathrooms <input readOnly value="2" /></label>
        <label className="form-field">Preferred date <input readOnly value="Next Friday morning" /></label>
        <button
          className="button-primary full"
          type="button"
          disabled
          aria-disabled="true"
          title="Fixture preview only; create/update request command is not integrated on this branch."
        >
          Continue request · preview
        </button>
      </form>
      <RequestSummaryPreview />
    </div>
  );
}

function CustomerPanel({ module }: { module: CustomerModule }) {
  const view = buildCustomerPortalView({
    request: sampleRequest,
    quote: sampleQuote,
    slot: sampleSlot,
    visit: sampleVisit,
    invoice: sampleInvoice,
    conversation: sampleConversation,
  });
  const config = customerModuleConfig[module];

  let moduleContent;
  switch (module) {
    case "overview":
      moduleContent = (
        <div className="card-grid three">
          <article className="plain-card">
            <span className="status-pill pending">Sample DTO data</span>
            <h2>{view.serviceLabel}</h2>
            <p>{view.quoteVersionLabel}</p>
            <p>{view.handoverLabel}</p>
          </article>
          <article className="plain-card">
            <span className="status-pill success">Current quote</span>
            <h2>{view.totalLabel}</h2>
            <p>Deposit {view.depositLabel}; balance {view.balanceLabel}</p>
            <p>{view.visitStatusLabel}</p>
          </article>
          <article className="plain-card">
            <span className="status-pill attention">{view.slotFreshness}</span>
            <h2>Appointment slot</h2>
            <p>Slot freshness must be checked by the facade before instant confirmation.</p>
          </article>
        </div>
      );
      break;
    case "properties":
      moduleContent = <PropertyRecurringPreview />;
      break;
    case "quote":
      moduleContent = (
        <section className="plain-card" aria-label="Customer quote preview">
          <span className="status-pill success">Current quote</span>
          <h2>{view.totalLabel}</h2>
          <p>{view.quoteVersionLabel}; acceptance must target the exact current version.</p>
          <p>Deposit {view.depositLabel}; balance {view.balanceLabel}.</p>
        </section>
      );
      break;
    case "booking":
      moduleContent = <CheckoutPreview />;
      break;
    case "invoice":
      moduleContent = <InvoiceLedgerPreview />;
      break;
    case "preferences":
      moduleContent = <CommunicationPreferences />;
      break;
  }

  return (
    <div className="customer-workspace-stack">
      <section className="mini-panel" aria-label={`${config.label} module context`}>
        <span className="status-pill neutral">Customer portal</span>
        <h2>{config.label}</h2>
        <p>{config.description}</p>
      </section>
      {moduleContent}
    </div>
  );
}

function StaffPanel({ module }: { module: StaffModule }) {
  const view = buildStaffQueueView({
    request: sampleRequest,
    quote: sampleQuote,
    conversation: sampleConversation,
    attentionItems: sampleAttentionItems,
    integrations: sampleIntegrations,
  });
  const config = staffModuleConfig[module];

  let moduleContent;
  switch (module) {
    case "overview":
      moduleContent = <StaffAttentionOverview view={view} />;
      break;
    case "inbox":
      moduleContent = <InboxPreview />;
      break;
    case "customers":
      moduleContent = <CrmPreview />;
      break;
    case "requests":
      moduleContent = <RequestSummaryPreview />;
      break;
    case "quotes":
      moduleContent = <QuoteApprovalPreview />;
      break;
    case "schedule":
      moduleContent = <SchedulePreview />;
      break;
    case "jobs":
      moduleContent = (
        <section className="plain-card" aria-label="Staff jobs preview">
          <span className="status-pill pending">DTO-derived sample</span>
          <h2>Visit {sampleVisit.id}</h2>
          <p>Status {sampleVisit.status.replaceAll("_", " ")} · crew {sampleVisit.crewId ?? "unassigned"}.</p>
          <p>Staff assignment and transition commands remain server-authorized through the core facade.</p>
        </section>
      );
      break;
    case "invoices":
      moduleContent = <InvoiceLedgerPreview />;
      break;
    case "reports":
      moduleContent = <ReportsPreview />;
      break;
    case "billing":
      moduleContent = <PlatformBillingPreview />;
      break;
    case "quality":
      moduleContent = <QualityReviewPreview embedded />;
      break;
    case "automations":
      moduleContent = <RecoveryActionsPreview embedded />;
      break;
    case "settings":
      moduleContent = <OwnerSettingsPreview embedded />;
      break;
  }

  return (
    <div className="staff-workspace-stack">
      <section className="mini-panel" aria-label={`${config.label} module context`}>
        <span className="status-pill neutral">{config.group}</span>
        <h2>{config.label}</h2>
        <p>{config.description}</p>
      </section>
      {moduleContent}
    </div>
  );
}

function StaffAttentionOverview({
  view,
}: {
  view: ReturnType<typeof buildStaffQueueView>;
}) {
  return (
    <div className="tri-pane-preview" aria-label="Staff attention queue preview">
      <aside>
        <p className="label">Attention queue</p>
        {view.items.map((item, index) => (
          <button
            className={`list-row${index === 0 ? " active" : ""}`}
            key={item.id}
            type="button"
            disabled
            aria-disabled="true"
          >
            {item.severity} · {item.summary}
          </button>
        ))}
      </aside>
      <section>
        <p className="label">Request context</p>
        <h3>{view.requestLabel}</h3>
        <p>{view.quoteLabel}</p>
        <p>{view.handoverLabel}; AI draft only.</p>
      </section>
      <aside>
        <p className="label">Next action</p>
        <ul className="check-list">
          {view.items.map((item) => (
            <li key={item.id}>{item.resourceLabel}: {item.integrationLabel ?? item.nextAction}</li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

function CrewPanel() {
  return <CrewJobPreview />;
}

function OnboardingPanel() {
  return (
    <div className="staff-workspace-stack">
      <OnboardingReadiness />
      <ConnectorOperationsPreview />
      <div className="card-grid two">
        {integrationCards.map((integration) => (
          <article className="plain-card" key={integration.title}>
            <span className="status-pill pending">Setup required</span>
            <h2>{integration.title}</h2>
            <p>{integration.detail}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function TourPanel() {
  return (
    <div className="plain-card">
      <p className="eyebrow">Isolated showcase session</p>
      <h2>Tour commands use sample records and must not affect another tenant.</h2>
      <p>Test payment and synthetic history are labelled until Chat 2 supplies real provider receipts.</p>
    </div>
  );
}

function RouteStatePreview() {
  return (
    <section className="state-preview" aria-label="Reusable loading, empty and error states">
      {uiStateScenarios.map((scenario) => (
        <UIStateCard key={scenario.state} scenario={scenario} />
      ))}
    </section>
  );
}
