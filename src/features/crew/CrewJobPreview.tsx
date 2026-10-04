import type { InvoiceDTO, RequestDTO, VisitDTO } from "@/contracts";
import { buildCrewExecutionView } from "./view-models";

interface CrewJobPreviewProps {
  request: RequestDTO;
  visit: VisitDTO;
  invoice: InvoiceDTO;
}

export function CrewJobPreview(props?: CrewJobPreviewProps) {
  if (!props) {
    return (
      <section className="two-column" aria-label="Crew job execution preview">
        <div className="mobile-preview">
          <p className="label">Crew mobile · server data required</p>
          <h2>Visit snapshot required</h2>
          <button
            className="button-primary full"
            type="button"
            disabled
            aria-disabled="true"
            title="Server-backed preview only; visit transition command is not integrated on this branch."
          >
            Transition unavailable · preview
          </button>
        </div>
      </section>
    );
  }

  const view = buildCrewExecutionView({
    request: props.request,
    visit: props.visit,
    invoice: props.invoice,
  });

  return (
    <section className="two-column" aria-label="Crew job execution preview">
      <div className="mobile-preview">
        <p className="label">Crew mobile · fixture UI</p>
        <h2>{view.requestLabel}</h2>
        <p>{view.currentStatus.replaceAll("_", " ").toLowerCase()}</p>
        <button
          className="button-primary full"
          type="button"
          disabled
          aria-disabled="true"
          title="Fixture preview only; visit transition command is not integrated on this branch."
        >
          {view.primaryAction} · preview
        </button>
        <ol className="timeline-list" aria-label="Visit status progression">
          {view.timeline.map((step, index) => (
            <li key={step.status}>
              <span aria-hidden="true">{index + 1}</span>
              <p>{step.current ? "Current: " : step.reached ? "Done: " : "Next: "}{step.label}</p>
            </li>
          ))}
        </ol>
      </div>

      <div className="card-grid two">
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
