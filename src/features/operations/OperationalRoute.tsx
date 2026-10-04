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
import { integrationCards, uiStateScenarios } from "@/features/product/story-model";
import { QualityReviewPreview } from "@/features/quality/QualityReviewPreview";
import { QuoteApprovalPreview } from "@/features/quotes/QuoteApprovalPreview";
import { RecoveryActionsPreview } from "@/features/recovery/RecoveryActionsPreview";
import { ReportsPreview } from "@/features/reports/ReportsPreview";
import { EnquiryForm } from "@/features/request-intake/EnquiryForm";
import { RequestSummaryPreview } from "@/features/request-intake/RequestSummaryPreview";
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
  staffNavigationGroups,
  staffModuleConfig,
  type StaffModule,
} from "./staff-modules";
import {
  buildCustomerPortalView,
  buildStaffQueueView,
} from "./view-models";
import type { OperationalRouteData, OperationalRoutePropsBase } from "./route-data";

interface OperationalRouteProps extends OperationalRoutePropsBase {
  data?: OperationalRouteData;
}

const surfaceNav: Record<"onboarding" | "tour", string[]> = {
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
  data,
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
                href={buildCrewModuleHref(item.module, data?.navigation.visitId ?? "server-visit-pending")}
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
                  quoteId: data?.navigation.quoteId ?? "server-quote-pending",
                  bookingId: data?.navigation.bookingId ?? "server-booking-pending",
                  invoiceId: data?.navigation.invoiceId ?? "server-invoice-pending",
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
          <p className="eyebrow">{surface} route · {resourceLabel ?? data?.sourceLabel ?? "server snapshot pending"}</p>
          <h1>{title}</h1>
          <p className="lead">{description}</p>
        </div>
        {surface === "business" && <BusinessPanel module={businessModule} slug={businessSlug} data={data} />}
        {surface === "customer" && <CustomerPanel module={customerModule} data={data} />}
        {surface === "staff" && <StaffPanel module={staffModule} data={data} />}
        {surface === "crew" && <CrewPanel module={crewModule} data={data} />}
        {surface === "onboarding" && <OnboardingPanel />}
        {surface === "tour" && <TourPanel />}
        <RouteStatePreview />
      </section>
    </main>
  );
}

function BoundaryCard({ title, detail }: { title: string; detail: string }) {
  return (
    <section className="plain-card">
      <span className="status-pill attention">Server boundary</span>
      <h2>{title}</h2>
      <p>{detail}</p>
    </section>
  );
}

function BusinessPanel({
  module,
  slug,
  data,
}: {
  module: BusinessModule;
  slug: string;
  data?: OperationalRouteData;
}) {
  const config = businessModuleConfig[module];
  let moduleContent;

  switch (module) {
    case "home":
      moduleContent = (
        <div className="card-grid three">
          <article className="plain-card">
            <span className="status-pill success">Service catalog</span>
            <h2>Move-out cleaning</h2>
            <p>Service catalog, pricing copy and availability labels stay visible while real service snapshots are pending.</p>
          </article>
          <article className="plain-card">
            <span className="status-pill neutral">Operating area</span>
            <h2>Residential cleaning</h2>
            <p>Public copy stays generic until owner settings provide authoritative service areas and policy data.</p>
          </article>
          <article className="plain-card">
            <span className="status-pill pending">How it works</span>
            <h2>Ask → quote → hold → pay deposit</h2>
            <p>Each step is separated from provider proof so sandbox payment and fixture Calendar states stay labelled.</p>
          </article>
        </div>
      );
      break;
    case "enquire":
      moduleContent = data?.business.enquiry ? (
        <div className="hero-grid">
          <EnquiryForm
            values={data.business.enquiry.form}
            modeLabel={data.business.enquiry.form.modeLabel}
            boundaryNotice={data.business.enquiry.form.boundaryNotice}
          />
          <RequestSummaryPreview request={data.business.enquiry.summary.request} quote={data.business.enquiry.summary.quote} />
        </div>
      ) : (
        <BoundaryCard
          title="Business enquiry requires accepted server commands"
          detail="The public form delegates to createRequest, updateRequest and calculateQuote after a server action factory is injected."
        />
      );
      break;
    case "book":
      moduleContent = data?.business.checkout ? (
        <div className="customer-workspace-stack">
          <section className="plain-card" aria-label="Public booking boundary">
            <span className="status-pill attention">Sandbox checkout boundary</span>
            <h2>Booking waits for a fresh slot and verified payment evidence</h2>
            <p>Public booking can preview the quote and hold state, but hosted checkout remains disabled until E03 is complete.</p>
          </section>
          <CheckoutPreview {...data.business.checkout} />
        </div>
      ) : (
        <BoundaryCard
          title="Hosted checkout disabled"
          detail="Current E03 payment bridge is not complete, so checkout stays sandbox-labelled and fixture-only."
        />
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

function CustomerPanel({ module, data }: { module: CustomerModule; data?: OperationalRouteData }) {
  const overview = data?.customer.overview ? buildCustomerPortalView(data.customer.overview) : undefined;
  const config = customerModuleConfig[module];

  let moduleContent;
  switch (module) {
    case "overview":
      moduleContent = overview ? (
        <div className="card-grid three">
          <article className="plain-card">
            <span className="status-pill pending">{data?.sourceLabel === "FIXTURE_UI_ONLY" ? "Fixture DTO data" : "Server DTO data"}</span>
            <h2>{overview.serviceLabel}</h2>
            <p>{overview.quoteVersionLabel}</p>
            <p>{overview.handoverLabel}</p>
          </article>
          <article className="plain-card">
            <span className="status-pill success">Current quote</span>
            <h2>{overview.totalLabel}</h2>
            <p>Deposit {overview.depositLabel}; balance {overview.balanceLabel}</p>
            <p>{overview.visitStatusLabel}</p>
          </article>
          <article className="plain-card">
            <span className="status-pill attention">{overview.slotFreshness}</span>
            <h2>Appointment slot</h2>
            <p>Slot freshness must be checked by the facade before instant confirmation.</p>
          </article>
        </div>
      ) : (
        <BoundaryCard title="Customer snapshot required" detail="Portal overview waits for a server snapshot before fixture replacement." />
      );
      break;
    case "properties":
      moduleContent = <PropertyRecurringPreview />;
      break;
    case "quote":
      moduleContent = overview ? (
        <section className="plain-card" aria-label="Customer quote preview">
          <span className="status-pill success">Current quote</span>
          <h2>{overview.totalLabel}</h2>
          <p>{overview.quoteVersionLabel}; acceptance must target the exact current version.</p>
          <p>Deposit {overview.depositLabel}; balance {overview.balanceLabel}.</p>
        </section>
      ) : (
        <BoundaryCard title="Quote snapshot required" detail="Quote actions remain server-authoritative and versioned." />
      );
      break;
    case "booking":
      moduleContent = data?.customer.checkout ? (
        <CheckoutPreview {...data.customer.checkout} />
      ) : (
        <BoundaryCard title="Booking snapshot required" detail="Hosted checkout stays disabled until E03 completes." />
      );
      break;
    case "invoice":
      moduleContent = data?.customer.invoice ? (
        <InvoiceLedgerPreview invoice={data.customer.invoice} />
      ) : (
        <BoundaryCard title="Invoice snapshot required" detail="Invoice rendering waits for server data." />
      );
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

function StaffPanel({ module, data }: { module: StaffModule; data?: OperationalRouteData }) {
  const view = data?.staff.attention ? buildStaffQueueView(data.staff.attention) : undefined;
  const config = staffModuleConfig[module];

  let moduleContent;
  switch (module) {
    case "overview":
      moduleContent = view ? <StaffAttentionOverview view={view} /> : <BoundaryCard title="Staff snapshot required" detail="Staff overview waits for accepted snapshots." />;
      break;
    case "inbox":
      moduleContent = <InboxPreview />;
      break;
    case "customers":
      moduleContent = data?.staff.crm ? <CrmPreview {...data.staff.crm} /> : <BoundaryCard title="CRM snapshot required" detail="Customer records wait for server reads." />;
      break;
    case "requests":
      moduleContent = data?.staff.requestSummary ? (
        <RequestSummaryPreview request={data.staff.requestSummary.request} quote={data.staff.requestSummary.quote} />
      ) : (
        <BoundaryCard title="Request snapshot required" detail="Requests remain server authoritative." />
      );
      break;
    case "quotes":
      moduleContent = data?.staff.quoteApproval ? <QuoteApprovalPreview {...data.staff.quoteApproval} /> : <BoundaryCard title="Quote snapshot required" detail="Quote actions wait for accepted commands." />;
      break;
    case "schedule":
      moduleContent = data?.staff.schedule ? <SchedulePreview {...data.staff.schedule} /> : <BoundaryCard title="Schedule snapshot required" detail="Schedule actions wait for findSlots and holdSlot adapters." />;
      break;
    case "jobs":
      moduleContent = data?.staff.jobsVisit ? (
        <section className="plain-card" aria-label="Staff jobs preview">
          <span className="status-pill pending">DTO-derived sample</span>
          <h2>Visit {data.staff.jobsVisit.id}</h2>
          <p>Status {data.staff.jobsVisit.status.replaceAll("_", " ")} · crew {data.staff.jobsVisit.crewId ?? "unassigned"}.</p>
          <p>Staff assignment and transition commands remain server-authorized through the core facade.</p>
        </section>
      ) : (
        <BoundaryCard title="Jobs snapshot required" detail="Job transitions remain disabled until accepted commands exist." />
      );
      break;
    case "invoices":
      moduleContent = data?.staff.crm.invoice ? <InvoiceLedgerPreview invoice={data.staff.crm.invoice} /> : <BoundaryCard title="Invoice snapshot required" detail="Invoice data waits for server reads." />;
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

function CrewPanel({ module, data }: { module: CrewModule; data?: OperationalRouteData }) {
  const config = crewModuleConfig[module];
  const moduleContent = module === "today" ? (
    data?.crew.today ? (
      <div className="mobile-preview" aria-label="Crew assigned visits preview">
        <p className="label">Crew mobile · today</p>
        <h2>Assigned visits</h2>
        <article className="mini-panel">
          <span className="status-pill pending">{data.crew.today.visit.status.replaceAll("_", " ")}</span>
          <h3>{data.crew.today.request.serviceCode ?? "Cleaning visit"}</h3>
          <p>{data.crew.today.visit.startAt} · crew {data.crew.today.visit.crewId ?? "unassigned"}</p>
          <a className="button-primary full" href={buildCrewModuleHref("job", data.crew.today.visit.id)}>Open job detail</a>
        </article>
        <p>V1 requires network access for authoritative field updates; offline sync is not claimed.</p>
      </div>
    ) : (
      <BoundaryCard title="Crew snapshot required" detail="Crew routes wait for visit snapshots." />
    )
  ) : data?.crew.job ? (
    <CrewJobPreview {...data.crew.job} />
  ) : (
    <BoundaryCard title="Crew job snapshot required" detail="Crew mutations remain disabled until E06 exists." />
  );

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
      <h2>Tour commands use fixture records and must not affect another tenant.</h2>
      <p>Test payment and synthetic history are labelled until provider receipts are supplied.</p>
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
