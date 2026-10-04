import {
  crewActions,
  customerJourneyCards,
  integrationCards,
  moveOutFixture,
  staffModules,
} from "@/features/product/story-model";

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
  return (
    <div className="card-grid three">
      {customerJourneyCards.map((card) => (
        <article className="plain-card" key={card.title}>
          <span className="status-pill success">{card.state}</span>
          <h2>{card.title}</h2>
          <p>{card.detail}</p>
        </article>
      ))}
    </div>
  );
}

function StaffPanel() {
  return (
    <div className="tri-pane-preview" aria-label="Staff workspace preview">
      <aside>
        <p className="label">Attention queue</p>
        <button className="list-row active">Quote needs approval</button>
        <button className="list-row">Calendar freshness stale</button>
        <button className="list-row">Delivery uncertain</button>
      </aside>
      <section>
        <p className="label">Shared inbox</p>
        <div className="message incoming">Customer changed date after quote was sent.</div>
        <div className="message outgoing">Human handover active. AI draft only.</div>
      </section>
      <aside>
        <p className="label">Operational modules</p>
        <ul className="check-list">{staffModules.map((module) => <li key={module}>{module}</li>)}</ul>
      </aside>
    </div>
  );
}

function CrewPanel() {
  return (
    <div className="two-column">
      <div className="mobile-preview">
        <p className="label">Today</p>
        <h2>09:00 · Move-out clean</h2>
        <button className="button-primary full" type="button">Start travel</button>
        <ul className="check-list">{crewActions.map((action) => <li key={action}>{action}</li>)}</ul>
      </div>
      <aside className="plain-card">
        <p className="label">Completion review</p>
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
