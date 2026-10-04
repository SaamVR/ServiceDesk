import { UIStateCard } from "@/components/shell/UIState";
import { CheckoutPreview } from "@/features/checkout/CheckoutPreview";
import { InboxPreview } from "@/features/inbox/InboxPreview";
import {
  crewActions,
  integrationCards,
  moveOutFixture,
  staffModules,
  uiStateScenarios,
} from "@/features/product/story-model";
import { SchedulePreview } from "@/features/schedule/SchedulePreview";
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
  buildCrewJobView,
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
}

const surfaceNav: Record<Surface, string[]> = {
  business: ["Services", "Areas", "FAQs", "Enquire", "Book"],
  customer: ["Portal", "Properties", "Quotes", "Bookings", "Invoices", "Preferences"],
  staff: ["Overview", "Inbox", "Customers", "Quotes", "Schedule", "Jobs", "Invoices", "Operations", "Settings"],
  crew: ["Today", "Job detail", "Checklist", "Proof", "Incident", "Completion"],
  onboarding: ["Business", "Services", "Team", "Policies", "Integrations", "Readiness"],
  tour: ["Scenario", "Command", "Receipt label", "Recovery", "Presentation"],
};

export function OperationalRoute({ surface, title, description, workspaceLabel = "BrightRoom Services", resourceLabel }: OperationalRouteProps) {
  return (
    <main className="site-shell">
      <header className="site-header" aria-label={`${surface} workspace navigation`}>
        <a className="brand-lockup" href="/">
          <span className="brand-mark" aria-hidden="true">SD</span>
          <span>{workspaceLabel}</span>
        </a>
        <nav className="site-nav" aria-label="Workspace">
          {surfaceNav[surface].map((item) => <a href="#workspace" key={item}>{item}</a>)}
        </nav>
      </header>

      <section className="section-card" id="workspace">
        <div className="section-heading compact">
          <p className="eyebrow">{surface} route · {resourceLabel ?? "sample workspace"}</p>
          <h1>{title}</h1>
          <p className="lead">{description}</p>
        </div>
        {surface === "business" && <BusinessPanel />}
        {surface === "customer" && <CustomerPanel />}
        {surface === "staff" && <StaffPanel />}
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
        <button className="button-primary full" type="button">Continue request</button>
      </form>
      <aside className="plain-card">
        <p className="label">AI chat + editable summary</p>
        <div className="message incoming">Do you cover SW11?</div>
        <div className="message outgoing">Area validation is pending through the service-area tool.</div>
        <dl className="summary-list">
          <div><dt>Quote status</dt><dd>Draft</dd></div>
          <div><dt>Hold</dt><dd>{moveOutFixture.holdMinutes}m after slot selection</dd></div>
          <div><dt>Provider history</dt><dd>Synthetic sample</dd></div>
        </dl>
      </aside>
    </div>
  );
}

function CustomerPanel() {
  const view = buildCustomerPortalView({
    request: sampleRequest,
    quote: sampleQuote,
    slot: sampleSlot,
    visit: sampleVisit,
    invoice: sampleInvoice,
    conversation: sampleConversation,
  });

  return (
    <div className="customer-workspace-stack">
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
      <CheckoutPreview />
    </div>
  );
}

function StaffPanel() {
  const view = buildStaffQueueView({
    request: sampleRequest,
    quote: sampleQuote,
    conversation: sampleConversation,
    attentionItems: sampleAttentionItems,
    integrations: sampleIntegrations,
  });

  return (
    <div className="staff-workspace-stack">
      <div className="tri-pane-preview" aria-label="Staff attention queue preview">
        <aside>
          <p className="label">Attention queue</p>
          {view.items.map((item, index) => (
            <button className={`list-row${index === 0 ? " active" : ""}`} key={item.id}>
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
          <p className="label">Context</p>
          <ul className="check-list">
            {view.items.map((item) => (
              <li key={item.id}>{item.resourceLabel}: {item.integrationLabel ?? item.nextAction}</li>
            ))}
            {staffModules.slice(0, 3).map((module) => <li key={module}>{module}</li>)}
          </ul>
        </aside>
      </div>
      <InboxPreview />
      <SchedulePreview />
    </div>
  );
}

function CrewPanel() {
  const view = buildCrewJobView({ request: sampleRequest, visit: sampleVisit, invoice: sampleInvoice });

  return (
    <div className="two-column">
      <div className="mobile-preview">
        <p className="label">Today · sample assigned job</p>
        <h2>{view.requestLabel}</h2>
        <p>{view.statusLabel} · {view.durationLabel}</p>
        <button className="button-primary full" type="button">{view.nextAction}</button>
        <ul className="check-list">{crewActions.slice(2).map((action) => <li key={action}>{action}</li>)}</ul>
      </div>
      <aside className="plain-card">
        <p className="label">Completion review</p>
        <p>{view.balanceLabel}</p>
        <p>Checklist, photo evidence, time/material note and incident state are separate. Completion requires review before balance invoice.</p>
        <span className="status-pill attention">Pending review</span>
      </aside>
    </div>
  );
}

function OnboardingPanel() {
  return (
    <div className="card-grid two">
      {integrationCards.map((integration) => (
        <article className="plain-card" key={integration.title}>
          <span className="status-pill pending">Setup required</span>
          <h2>{integration.title}</h2>
          <p>{integration.detail}</p>
        </article>
      ))}
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
