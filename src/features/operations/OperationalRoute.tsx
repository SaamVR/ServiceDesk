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
import { EnquiryForm } from "@/features/request-intake/EnquiryForm";
import { RequestSummaryFixturePreview } from "@/features/request-intake/RequestSummaryFixturePreview";
import { SchedulePreview } from "@/features/schedule/SchedulePreview";
import { OwnerSettingsPreview } from "@/features/settings/OwnerSettingsPreview";
import {
  buildBusinessModuleHref,
  businessModuleConfig,
  businessNavigation,
  type BusinessModule,
} from "./business-modules";
import {
  buildCrewModuleHref,
  crewModuleConfig,
  crewNavigation,
  type CrewModule,
} from "./crew-modules";
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
  businessModule?: BusinessModule;
  businessSlug?: string;
  crewModule?: CrewModule;
  customerModule?: CustomerModule;
  staffModule?: StaffModule;
}

const surfaceNav: Record<Exclude<Surface, "business" | "crew" | "customer" | "staff">, string[]> = {
  onboarding: ["Business", "Services", "Team", "Policies", "Integrations", "Readiness"],
  tour: ["Scenario", "Command", "Receipt label", "Recovery", "Presentation"],
};

export function OperationalRoute({
  surface,
  title,
  description,
  workspaceLabel = "BrightRoom Services",
  resourceLabel,
  businessModule = "home",
  businessSlug = "brightroom",
  crewModule = "today",
  customerModule = "overview",
  staffModule = "overview",
}: OperationalRouteProps) {
  return (
    <main className="site-shell">
      <header className="site-header" aria-label={`${surface} workspace navigation`}>
        <a className="brand-lockup" href="/">
          <span className="brand-mark" aria-hidden="true">SD</span>
          <span>{workspaceLabel}</span>
        </a>
        {surface === "business" ? (
          <nav className="site-nav" aria-label="Business site">
            {businessNavigation.map((item) => (
              <a
                aria-current={businessModule === item.module ? "page" : undefined}
                href={buildBusinessModuleHref(businessSlug, item.module)}
                key={item.module}
              >
                {item.label}
              </a>
            ))}
          </nav>
        ) : surface === "crew" ? (
          <nav className="site-nav" aria-label="Crew workspace">
            {crewNavigation.map((item) => (
              <a
                aria-current={crewModule === item.module ? "page" : undefined}
                href={buildCrewModuleHref(item.module, sampleVisit.id)}
                key={item.module}
              >
                {item.label}
              </a>
            ))}
          </nav>
        ) : surface === "staff" ? (
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
        {surface === "business" && <BusinessPanel module={businessModule} slug={businessSlug} />}
        {surface === "customer" && <CustomerPanel module={customerModule} />}
        {surface === "staff" && <StaffPanel module={staffModule} />}
        {surface === "crew" && <CrewPanel module={crewModule} />}
        {surface === "onboarding" && <OnboardingPanel />}
        {surface === "tour" && <TourPanel />}
        <RouteStatePreview />
      </section>
    </main>
  );
}

function BusinessPanel({ module, slug }: { module: BusinessModule; slug: string }) {
  const config = businessModuleConfig[module];
  let moduleContent;

  switch (module) {
    case "home":
      moduleContent = (
        <div className="card-grid three">
          <article className="plain-card">
            <span className="status-pill success">Service catalog</span>
            <h2>Move-out cleaning</h2>
            <p>3 bedrooms, 2 bathrooms and oven cleaning map to the frozen $340 quote fixture.</p>
          </article>
          <article className="plain-card">
            <span className="status-pill neutral">Operating area</span>
            <h2>Residential cleaning</h2>
            <p>Public copy stays generic until owner settings provide real service areas and policy data.</p>
          </article>
          <article className="plain-card">
            <span className="status-pill pending">How it works</span>
            <h2>Ask → quote → hold → pay deposit</h2>
            <p>Every step is separated from provider proof so test payment and fixture Calendar states are visible.</p>
          </article>
        </div>
      );
      break;
    case "enquire":
      moduleContent = (
        <div className="hero-grid">
          <EnquiryForm
            values={{
              serviceLabel: sampleRequest.serviceCode ?? "Missing",
              bedroomsLabel: sampleRequest.bedrooms?.toString() ?? "Missing",
              bathroomsLabel: sampleRequest.bathrooms?.toString() ?? "Missing",
              requestedStartLabel: sampleRequest.requestedStartAt ?? "Missing",
            }}
            modeLabel="Fixture intake"
            boundaryNotice="No request is created from this UI until Chat 1 accepts the server create/update boundary."
          />
          <RequestSummaryFixturePreview />
        </div>
      );
      break;
    case "book":
      moduleContent = (
        <div className="customer-workspace-stack">
          <section className="plain-card" aria-label="Public booking boundary">
            <span className="status-pill attention">Sandbox checkout boundary</span>
            <h2>Booking waits for a fresh slot and verified payment evidence</h2>
            <p>Public booking can preview the quote and hold state, but receipts stay hidden until provider callbacks are verified.</p>
          </section>
          <CheckoutPreview />
        </div>
      );
      break;
  }

  return (
    <div className="customer-workspace-stack">
      <section className="mini-panel" aria-label={`${config.label} business module context`}>
        <span className="status-pill neutral">Business site</span>
        <h2>{config.label}</h2>
        <p>{config.description}</p>
        <div className="action-row">
          <a className="button-secondary" href={buildBusinessModuleHref(slug, "enquire")}>Start enquiry</a>
          <a className="button-secondary" href={buildBusinessModuleHref(slug, "book")}>Preview booking</a>
        </div>
      </section>
      {moduleContent}
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
      moduleContent = <RequestSummaryFixturePreview />;
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

function CrewPanel({ module }: { module: CrewModule }) {
  const config = crewModuleConfig[module];
  const moduleContent = module === "today" ? (
    <div className="mobile-preview" aria-label="Crew assigned visits preview">
      <p className="label">Crew mobile · today</p>
      <h2>Assigned visits</h2>
      <article className="mini-panel">
        <span className="status-pill pending">{sampleVisit.status.replaceAll("_", " ")}</span>
        <h3>{sampleRequest.serviceCode ?? "Cleaning visit"}</h3>
        <p>{sampleVisit.startAt} · crew {sampleVisit.crewId ?? "unassigned"}</p>
        <a className="button-primary full" href={buildCrewModuleHref("job", sampleVisit.id)}>Open job detail</a>
      </article>
      <p>V1 requires network access for authoritative field updates; offline sync is not claimed.</p>
    </div>
  ) : <CrewJobPreview />;

  return (
    <div className="customer-workspace-stack">
      <section className="mini-panel" aria-label={`${config.label} crew module context`}>
        <span className="status-pill neutral">Crew workspace</span>
        <h2>{config.label}</h2>
        <p>{config.description}</p>
      </section>
      {moduleContent}
    </div>
  );
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
