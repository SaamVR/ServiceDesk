import type { InvoiceDTO, RequestDTO, VisitDTO } from "@/contracts";
import type { CrewTransitionPresentation } from "./server-boundary";
import { buildCrewExecutionView } from "./view-models";

interface CrewJobPreviewProps {
  request: RequestDTO;
  visit: VisitDTO;
  invoice: InvoiceDTO;
  transition?: CrewTransitionPresentation;
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
            title="Server-backed preview only; visit transition command is not integrated on this route."
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
  const transition = props.transition ?? view.transition;
  const transitionDisabled = !transition.enabled || transition.pending === true;

  return (
    <section className="two-column" aria-label="Crew job execution preview">
      <div className="mobile-preview">
        <p className="label">Crew mobile · {transition.enabled ? "SERVER_ACTION_READY" : "FIXTURE_UI_ONLY / NOT_MUTATED"}</p>
        <h2>{view.requestLabel}</h2>
        <p>{view.currentStatus.replaceAll("_", " ").toLowerCase()}</p>
        <button
          className="button-primary full"
          type="button"
          disabled={transitionDisabled}
          aria-disabled={transitionDisabled ? "true" : undefined}
          title={transition.disabledReason ?? "Submits exactly one transitionVisit command through the injected server action."}
        >
          {transition.pending ? "Submitting server transition…" : transition.label}
        </button>
        {transition.stateLabel && <p className="label">{transition.stateLabel}</p>}
        <ol className="timeline-list" aria-label="Visit status progression">
          {view.timeline.map((step, index) => (
            <li key={step.status}>
              <span aria-hidden="true">{index + 1}</span>
              <p>{step.current ? "Current: " : step.reached ? "Reached: " : "Pending: "}{step.label}</p>
            </li>
          ))}
        </ol>
      </div>

      <div className="card-grid two">
        <article className="plain-card">
          <span className="status-pill attention">FIXTURE_UI_ONLY / NOT_PERSISTED</span>
          <h3>Checklist</h3>
          <ul className="check-list">
            {view.checklist.map((item) => (
              <li key={item.id}>{item.state} · {item.label}</li>
            ))}
          </ul>
        </article>

        <article className="plain-card">
          <span className="status-pill pending">{view.fieldEvidence.persistence}</span>
          <h3>Photo evidence</h3>
          <dl className="summary-list">
            {view.evidenceSlots.map((slot) => (
              <div key={slot.kind}><dt>{slot.label}</dt><dd>{slot.state} · {slot.persistence}</dd></div>
            ))}
          </dl>
          <button className="button-secondary full" type="button" disabled aria-disabled="true">
            Evidence submit disabled · future Core E06 command required
          </button>
        </article>

        <article className="plain-card">
          <span className="status-pill neutral">Field notes · NOT_PERSISTED</span>
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
