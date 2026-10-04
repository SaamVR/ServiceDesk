import {
  crewActions,
  customerJourneyCards,
  integrationCards,
  lifecycleSteps,
  moveOutFixture,
  operationalBenefits,
  presentationSlides,
  staffModules,
  tourScenarios,
} from "./story-model";

export function BenefitGrid() {
  return (
    <section className="grid-section" aria-labelledby="benefits-heading">
      <div className="section-heading">
        <p className="eyebrow">Operational benefits</p>
        <h2 id="benefits-heading">One record for the full cleaning lifecycle.</h2>
      </div>
      <div className="card-grid three">
        {operationalBenefits.map((benefit) => (
          <article className="plain-card" key={benefit}>
            <span className="card-number" aria-hidden="true">✓</span>
            <p>{benefit}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function LifecycleProof() {
  return (
    <section className="section-card" aria-labelledby="lifecycle-heading">
      <div className="section-heading compact">
        <p className="eyebrow">Workflow proof</p>
        <h2 id="lifecycle-heading">From first message to paid repeat visit.</h2>
        <p>Every step below maps to a stored request, quote, visit, invoice, delivery or attention record.</p>
      </div>
      <ol className="timeline-list">
        {lifecycleSteps.map((step, index) => (
          <li key={step}>
            <span>{index + 1}</span>
            <p>{step}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function FixturePricingCard() {
  return (
    <section className="section-card two-column" aria-labelledby="pricing-fixture-heading">
      <div>
        <p className="eyebrow">Frozen pricing fixture</p>
        <h2 id="pricing-fixture-heading">Move-out clean quote stays deterministic.</h2>
        <p>No AI output sets the price. The UI displays the quote snapshot returned by the core facade.</p>
      </div>
      <dl className="metric-grid">
        <div><dt>Total</dt><dd>$340</dd></div>
        <div><dt>Deposit</dt><dd>$85</dd></div>
        <div><dt>Balance</dt><dd>$255</dd></div>
        <div><dt>Duration</dt><dd>{moveOutFixture.serviceMinutes}+{moveOutFixture.bufferMinutes}m</dd></div>
      </dl>
    </section>
  );
}

export function IntegrationStatusGrid() {
  return (
    <section className="grid-section" aria-labelledby="integrations-heading">
      <div className="section-heading">
        <p className="eyebrow">Integration boundaries</p>
        <h2 id="integrations-heading">Provider states are visible and conservative.</h2>
        <p>Real receipts appear only after Chat 2 verifies controlled provider evidence.</p>
      </div>
      <div className="card-grid two">
        {integrationCards.map((card) => (
          <article className="plain-card" key={card.title}>
            <span className="status-pill pending">Configuration blocked</span>
            <h3>{card.title}</h3>
            <p><strong>{card.state}</strong></p>
            <p>{card.detail}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function CustomerJourneyPreview() {
  return (
    <section className="section-card" aria-labelledby="customer-heading">
      <div className="section-heading compact">
        <p className="eyebrow">Customer/business workspace</p>
        <h2 id="customer-heading">The customer can see what the business knows.</h2>
      </div>
      <div className="card-grid three">
        {customerJourneyCards.map((card) => (
          <article className="plain-card" key={card.title}>
            <span className="status-pill success">{card.state}</span>
            <h3>{card.title}</h3>
            <p>{card.detail}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function StaffWorkspacePreview() {
  return (
    <section className="section-card" aria-labelledby="staff-heading">
      <div className="section-heading compact">
        <p className="eyebrow">Staff app</p>
        <h2 id="staff-heading">Attention before dashboards.</h2>
        <p>Charts and reports are downstream of stored records; urgent work appears first.</p>
      </div>
      <div className="tri-pane-preview" aria-label="Staff inbox tri-pane preview">
        <aside>
          <p className="label">Inbox</p>
          <button className="list-row active" disabled type="button">Move-out clean · Needs quote</button>
          <button className="list-row" disabled type="button">Failed delivery · Recovery</button>
          <button className="list-row" disabled type="button">Crew absence · Reassign</button>
        </aside>
        <section>
          <p className="label">Conversation</p>
          <div className="message incoming">Can someone confirm arrival time?</div>
          <div className="message outgoing">Dispatcher reviewing the live crew schedule now.</div>
        </section>
        <aside>
          <p className="label">Context</p>
          <ul className="check-list">
            {staffModules.slice(0, 5).map((module) => <li key={module}>{module}</li>)}
          </ul>
        </aside>
      </div>
    </section>
  );
}

export function CrewWorkspacePreview() {
  return (
    <section className="section-card two-column" aria-labelledby="crew-heading">
      <div>
        <p className="eyebrow">Crew mobile workspace</p>
        <h2 id="crew-heading">A field view that is action-first.</h2>
        <p>Today cards surface the next safe status action; proof, checklist, time and incidents stay grouped under the job.</p>
      </div>
      <div className="mobile-preview" aria-label="Crew mobile job preview">
        <p className="label">Today · 09:00</p>
        <h3>Move-out clean · SW11</h3>
        <button className="button-primary full" disabled type="button">Start travel · preview</button>
        <ul className="check-list">
          {crewActions.slice(2).map((action) => <li key={action}>{action}</li>)}
        </ul>
      </div>
    </section>
  );
}

export function TourScenarioList() {
  return (
    <section className="grid-section" aria-labelledby="tour-heading">
      <div className="section-heading">
        <p className="eyebrow">Controlled tour</p>
        <h2 id="tour-heading">Three reviewable scenarios mapped to real routes.</h2>
        <p>Sample history is synthetic until Chat 2 supplies redacted provider receipts. Each card links only to implemented route surfaces.</p>
      </div>
      <div className="scenario-stack">
        {tourScenarios.map((scenario) => (
          <article className="plain-card scenario-card" id={scenario.id} key={scenario.id}>
            <div className="section-heading compact">
              <span className="status-pill pending">Synthetic history</span>
              <h3>{scenario.title}</h3>
              <p>{scenario.summary}</p>
            </div>
            <div className="action-row scenario-links" aria-label={`${scenario.title} route links`}>
              {scenario.routeLinks.map((link) => (
                <a className="button-secondary" href={link.href} key={link.href}>{link.label}</a>
              ))}
            </div>
            <ol className="mini-steps routed-steps">
              {scenario.steps.map((step, index) => (
                <li key={`${scenario.id}-${step.label}`}>
                  <span className="card-number" aria-hidden="true">{index + 1}</span>
                  <div>
                    <h4>{step.label}</h4>
                    <p>{step.detail}</p>
                    <p><span className="status-pill attention">{step.proofBoundary}</span></p>
                    <a href={step.routeHref}>Open route</a>
                  </div>
                </li>
              ))}
            </ol>
          </article>
        ))}
      </div>
    </section>
  );
}

export function PresentationSlidesPreview() {
  return (
    <section className="presentation-shell" aria-label="ServiceDesk AI presentation slides">
      {presentationSlides.map((slide) => (
        <article className="slide-card" id={`slide-${slide.order}`} key={slide.order} tabIndex={0}>
          <p className="eyebrow">Slide {slide.order} / 10</p>
          <h2>{slide.title}</h2>
          <p>{slide.body}</p>
          <a className="button-secondary" href={slide.tourHref}>Open linked tour step</a>
        </article>
      ))}
    </section>
  );
}
