import type { RecurrenceRuleDTO, VisitDTO } from "@/contracts";
import {
  sampleInvoice,
  sampleQuote,
  sampleRequest,
  sampleSlot,
  sampleVisit,
} from "@/features/operations/sample-data";
import { RecurrenceRulePreview } from "@/features/recurrence/RecurrenceRulePreview";
import { buildPropertyRecurringView } from "./view-models";

const fixtureRecurrenceRule: RecurrenceRuleDTO = {
  id: "rule_fixture_monthly_001",
  workspaceId: sampleRequest.workspaceId,
  requestId: sampleRequest.id,
  propertyId: sampleRequest.propertyId ?? "prop_sample",
  frequency: "MONTHLY",
  timezone: "America/New_York",
  localStartTime: "09:00",
  startsOn: "2026-11-01",
  endsOn: "2027-04-01",
  maxOccurrences: 6,
  generatedOccurrences: 1,
  status: "ACTIVE",
  nextOccurrenceOn: "2026-11-01",
  version: 1,
  createdAt: "2026-10-04T06:30:00.000Z",
  updatedAt: "2026-10-04T06:30:00.000Z",
};

interface PropertyRecurringPreviewProps {
  recurrenceRule?: RecurrenceRuleDTO;
  materializedVisits?: VisitDTO[];
  sourceLabel?: "SERVER_SNAPSHOT" | "FIXTURE_UI_ONLY";
  audience?: "customer" | "staff";
  actionsInjected?: boolean;
}

export function PropertyRecurringPreview({
  recurrenceRule = fixtureRecurrenceRule,
  materializedVisits = [sampleVisit],
  sourceLabel = "FIXTURE_UI_ONLY",
  audience = "customer",
  actionsInjected = false,
}: PropertyRecurringPreviewProps) {
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
        <p className="eyebrow">Properties · {sourceLabel}</p>
        <h2>{view.propertyLabel}</h2>
        <p>
          Property history and recurring visits render authoritative RecurrenceRuleDTO fields only.
          Product never calculates the next occurrence or materializes future VisitDTOs from a recurrence rule.
        </p>
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
          <span className="status-pill attention">{recurrenceRule.frequency.toLowerCase()}</span>
          <h3>Recurring visits</h3>
          <p>Next occurrence is shown only from server-supplied nextOccurrenceOn: {recurrenceRule.nextOccurrenceOn ?? "not supplied"}.</p>
        </article>
      </div>

      <RecurrenceRulePreview
        rule={recurrenceRule}
        materializedVisits={materializedVisits}
        audience={audience}
        actionsInjected={actionsInjected}
        sourceLabel={sourceLabel}
      />

      <ol className="timeline-list">
        {view.history.map((item, index) => (
          <li key={`${item.kind}-${item.label}`}><span>{index + 1}</span><p>{item.label}: {item.value}</p></li>
        ))}
      </ol>
    </section>
  );
}
