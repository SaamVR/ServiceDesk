import type { AttentionItemDTO, IntegrationStatusDTO, SlotDTO, VisitDTO } from "@/contracts";
import { buildScheduleLaneView } from "./view-models";

interface SchedulePreviewProps {
  slot: SlotDTO;
  visit?: VisitDTO;
  integrations: IntegrationStatusDTO[];
  attentionItems: AttentionItemDTO[];
}

export function SchedulePreview(props?: SchedulePreviewProps) {
  if (!props) {
    return (
      <section className="plain-card" aria-labelledby="schedule-preview-heading">
        <p className="label">Schedule lane</p>
        <h3 id="schedule-preview-heading">Authoritative slot data required</h3>
        <p>findSlots and holdSlot are not wired here; this reusable component renders supplied DTOs only.</p>
      </section>
    );
  }

  const scheduleView = buildScheduleLaneView({
    slot: props.slot,
    visit: props.visit,
    integrations: props.integrations,
    attentionItems: props.attentionItems,
  });

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
