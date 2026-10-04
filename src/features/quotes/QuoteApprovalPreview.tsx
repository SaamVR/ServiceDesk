import { sampleQuote, sampleRequest } from "@/features/operations/sample-data";
import { buildQuoteApprovalView } from "./view-models";

export function QuoteApprovalPreview() {
  const view = buildQuoteApprovalView({
    request: sampleRequest,
    currentQuote: sampleQuote,
    previousQuote: {
      ...sampleQuote,
      id: "quote_previous",
      version: 1,
      totalMinor: 31_000,
      depositMinor: 7_750,
      balanceMinor: 23_250,
      durationMinutes: 220,
    },
  });

  return (
    <section className="plain-card" aria-label="Staff quote approval preview">
      <div className="section-heading compact">
        <p className="eyebrow">Quote approval · staff boundary</p>
        <h2>{view.requestLabel}</h2>
        <p>{view.approvalBoundary}</p>
      </div>

      <div className="card-grid three">
        <article className="mini-panel">
          <span className="status-pill attention">{view.approval.ownerLabel}</span>
          <h3>{view.versionLabel}</h3>
          <p>{view.approval.riskLabel}</p>
        </article>
        <article className="mini-panel">
          <span className="status-pill success">Current quote</span>
          <dl className="summary-list">
            <div><dt>Total</dt><dd>{view.current.totalLabel}</dd></div>
            <div><dt>Deposit</dt><dd>{view.current.depositLabel}</dd></div>
            <div><dt>Duration</dt><dd>{view.current.durationLabel}</dd></div>
          </dl>
        </article>
        <article className="mini-panel">
          <span className="status-pill neutral">Version delta</span>
          <dl className="summary-list">
            <div><dt>Total change</dt><dd>{view.delta.totalDeltaLabel}</dd></div>
            <div><dt>Deposit change</dt><dd>{view.delta.depositDeltaLabel}</dd></div>
            <div><dt>Duration change</dt><dd>{view.delta.durationDeltaLabel}</dd></div>
          </dl>
        </article>
      </div>
    </section>
  );
}
