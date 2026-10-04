import type { QuoteDTO, RequestDTO } from "@/contracts";
import { buildQuoteApprovalView } from "./view-models";

interface QuoteApprovalPreviewProps {
  request: RequestDTO;
  currentQuote: QuoteDTO;
  previousQuote?: QuoteDTO;
}

export function QuoteApprovalPreview(props?: QuoteApprovalPreviewProps) {
  if (!props) {
    return (
      <section className="plain-card" aria-label="Staff quote approval preview">
        <div className="section-heading compact">
          <p className="eyebrow">Quote approval · server data required</p>
          <h2>Quote approval waits for an authoritative request and current quote.</h2>
          <p>ServiceDeskFacade.sendQuote is not wired here; this reusable component renders server-backed DTOs only.</p>
        </div>
      </section>
    );
  }

  const view = buildQuoteApprovalView({
    request: props.request,
    currentQuote: props.currentQuote,
    previousQuote: props.previousQuote,
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
