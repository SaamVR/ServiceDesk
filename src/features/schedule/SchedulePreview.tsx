import {
  sampleAttentionItems,
  sampleIntegrations,
  sampleSlot,
  sampleVisit,
} from "@/features/operations/sample-data";
import { buildScheduleLaneView } from "./view-models";

const scheduleView = buildScheduleLaneView({
  slot: sampleSlot,
  visit: sampleVisit,
  integrations: sampleIntegrations,
  attentionItems: sampleAttentionItems,
});

export function SchedulePreview() {
  return (
    <section className="plain-card" aria-labelledby="schedule-preview-heading">
      <p className="label">Schedule lane</p>
      <h3 id="schedule-preview-heading">{scheduleView.crewLabel} · {scheduleView.durationLabel}</h3>
      <div className="card-grid three">
        <div className="mini-panel">
          <span className="status-pill attention">{scheduleView.freshnessLabel}</span>
          <p>Instant confirmation: {scheduleView.canInstantConfirm ? "Allowed" : "Blocked"}</p>
        </div>
        <div className="mini-panel">
          <span className="status-pill pending">{scheduleView.integrationLabel}</span>
          <p>Provider state is separate from app booking state.</p>
        </div>
        <div className="mini-panel">
          <span className="status-pill failure">Conflict reasons</span>
          <ul className="check-list">
            {scheduleView.conflictReasons.map((reason) => <li key={reason}>{reason}</li>)}
          </ul>
        </div>
      </div>
    </section>
  );
}
