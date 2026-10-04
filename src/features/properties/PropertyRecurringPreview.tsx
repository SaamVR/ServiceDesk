import {
  sampleInvoice,
  sampleQuote,
  sampleRequest,
  sampleSlot,
  sampleVisit,
} from "@/features/operations/sample-data";
import { buildPropertyRecurringView } from "./view-models";

export function PropertyRecurringPreview() {
  const view = buildPropertyRecurringView({
    request: sampleRequest,
    quote: sampleQuote,
    slot: sampleSlot,
    visit: sampleVisit,
    invoice: sampleInvoice,
  });

  return (
    <section className="plain-card" aria-label="Property and recurring visit preview">
      <div className="section-heading compact">
        <p className="eyebrow">Properties · fixture only</p>
        <h2>{view.propertyLabel}</h2>
        <p>Property history and recurring visits are shown as a customer-facing proof panel, but they remain fixture-only until shared property and recurrence DTOs exist.</p>
      </div>

      <div className="card-grid three">
        <article className="mini-panel">
          <span className="status-pill pending">Property context</span>
          <dl className="summary-list">
            {view.propertyMeta.map((item) => (
              <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>
            ))}
          </dl>
        </article>

        <article className="mini-panel">
          <span className="status-pill success">Current visit</span>
          <dl className="summary-list">
            <div><dt>Start</dt><dd>{view.currentVisit.startLabel}</dd></div>
            <div><dt>Crew</dt><dd>{view.currentVisit.crewLabel}</dd></div>
            <div><dt>Duration</dt><dd>{view.currentVisit.durationLabel}</dd></div>
            <div><dt>Quote</dt><dd>{view.currentVisit.quoteLabel}</dd></div>
          </dl>
        </article>

        <article className="mini-panel">
          <span className="status-pill attention">{view.recurringCandidate.frequencyLabel}</span>
          <h3>Recurring visits</h3>
          <p>{view.recurringCandidate.blocker}</p>
        </article>
      </div>

      <ol className="timeline-list">
        {view.history.map((item, index) => (
          <li key={`${item.kind}-${item.label}`}><span>{index + 1}</span><p>{item.label}: {item.value}</p></li>
        ))}
      </ol>
    </section>
  );
}
