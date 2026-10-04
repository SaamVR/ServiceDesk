import { sampleInvoice, sampleQuote, sampleRequest, sampleVisit } from "@/features/operations/sample-data";
import { buildReportingView } from "./view-models";

export function ReportsPreview() {
  const view = buildReportingView({
    requests: [sampleRequest, { ...sampleRequest, id: "req_lost_sample", status: "LOST" }],
    quotes: [sampleQuote],
    visits: [sampleVisit],
    invoices: [sampleInvoice],
  });

  return (
    <section className="reports-preview" aria-label="Stored-record reporting preview">
      <div>
        <p className="eyebrow">Reports · stored records only</p>
        <h2>Numbers stay tied to source records.</h2>
        <p>{view.warning}</p>
      </div>
      <div className="metric-grid">
        {view.cards.map((card) => (
          <div key={card.label}>
            <dt>{card.label}</dt>
            <dd>{card.value}</dd>
            <p>{card.evidence}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
