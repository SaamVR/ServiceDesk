import type { RecurrenceRuleDTO, VisitDTO } from "@/contracts";
import type { ProductActionState } from "@/features/operations/action-state";
import { buildRecurrenceRuleView, type RecurrenceAudience } from "./view-models";

interface RecurrenceRulePreviewProps {
  rule: RecurrenceRuleDTO;
  materializedVisits?: VisitDTO[];
  audience: RecurrenceAudience;
  actionsInjected?: boolean;
  actionState?: ProductActionState;
  sourceLabel?: "SERVER_SNAPSHOT" | "FIXTURE_UI_ONLY";
}

export function RecurrenceRulePreview({
  rule,
  materializedVisits = [],
  audience,
  actionsInjected = false,
  actionState,
  sourceLabel = "SERVER_SNAPSHOT",
}: RecurrenceRulePreviewProps) {
  const view = buildRecurrenceRuleView({ rule, materializedVisits, audience, actionsInjected, actionState });

  return (
    <section className="plain-card" aria-label="Recurrence rule server boundary preview">
      <div className="section-heading compact">
        <p className="eyebrow">Recurrence · {sourceLabel}</p>
        <h2>{view.frequencyLabel} recurrence · {view.status.toLowerCase()}</h2>
        <p>{view.noClientScheduleTruthLabel}</p>
      </div>

      <dl className="summary-list">
        <div><dt>Window</dt><dd>{view.activeWindowLabel}</dd></div>
        <div><dt>Generated</dt><dd>{view.occurrenceProgressLabel}</dd></div>
        <div><dt>Next occurrence</dt><dd>{view.nextOccurrenceLabel}</dd></div>
        <div><dt>Timezone</dt><dd>{view.timezoneLabel}</dd></div>
        <div><dt>Local start</dt><dd>{view.localStartTimeLabel}</dd></div>
      </dl>

      <div className="action-row" aria-label="Recurrence actions">
        {view.actionAvailability.controls.map((control) => (
          <button
            className="button-secondary"
            type="button"
            disabled={!control.enabled}
            aria-disabled={!control.enabled}
            title={control.disabledReason ?? "Server action required; UI mutates only after authoritative success."}
            key={control.action}
          >
            {control.label}
          </button>
        ))}
      </div>

      {actionState ? <p>{actionState.message}</p> : null}

      <div className="card-grid two" aria-label="Materialized occurrence visits">
        {view.materializedVisitCards.length > 0 ? view.materializedVisitCards.map((visit) => (
          <article className="mini-panel" key={visit.id}>
            <span className="status-pill neutral">VisitDTO</span>
            <h3>{visit.id}</h3>
            <p>{visit.status.replaceAll("_", " ")} · {visit.startAt}</p>
            <p>Crew {visit.crewLabel}</p>
          </article>
        )) : (
          <article className="mini-panel">
            <span className="status-pill pending">No VisitDTO materialized</span>
            <h3>Future visits are not synthesized in Product</h3>
            <p>Occurrence cards appear only when server snapshots supply VisitDTO records.</p>
          </article>
        )}
      </div>
    </section>
  );
}
