import { sampleInvoice, sampleRequest, sampleVisit } from "@/features/operations/sample-data";
import { buildCrewExecutionView } from "./view-models";

export function CrewJobPreview() {
  const view = buildCrewExecutionView({
    request: sampleRequest,
    visit: { ...sampleVisit, status: "IN_PROGRESS" },
    invoice: sampleInvoice,
  });

  return (
    <section className="crew-job-panel" aria-label="Crew job execution preview">
      <div className="mobile-preview crew-phone">
        <p className="label">Crew mobile · fixture UI</p>
        <h2>{view.requestLabel}</h2>
        <p>{view.currentStatus.replaceAll("_", " ").toLowerCase()}</p>
        <button className="button-primary full" type="button">{view.primaryAction}</button>
        <ol className="crew-timeline" aria-label="Visit status progression">
          {view.timeline.map((step) => (
            <li className={step.current ? "current" : step.reached ? "reached" : undefined} key={step.status}>
              <span aria-hidden="true" />
              {step.label}
            </li>
          ))}
        </ol>
      </div>

      <div className="crew-workspace">
        <article className="plain-card">
          <span className="status-pill attention">Review required before customer completion</span>
          <h3>Checklist</h3>
          <ul className="check-list">
            {view.checklist.map((item) => (
              <li key={item.id}>{item.complete ? "✓" : "○"} {item.label}</li>
            ))}
          </ul>
        </article>

        <article className="plain-card">
          <span className="status-pill pending">Fixture evidence slots</span>
          <h3>Photo evidence</h3>
          <dl className="summary-list">
            {view.evidenceSlots.map((slot) => (
              <div key={slot.kind}><dt>{slot.label}</dt><dd>{slot.state}</dd></div>
            ))}
          </dl>
        </article>

        <article className="plain-card">
          <span className="status-pill neutral">Field notes</span>
          <h3>{view.timeNote.label}</h3>
          <p>{view.timeNote.value}</p>
          <p>{view.incident.status}. {view.incident.escalationLabel}</p>
        </article>

        <article className="plain-card">
          <span className="status-pill pending">Business boundary</span>
          <h3>{view.balanceLabel}</h3>
          <p>{view.businessBoundary}</p>
        </article>
      </div>
    </section>
  );
}
