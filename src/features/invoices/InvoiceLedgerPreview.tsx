import { sampleInvoice } from "@/features/operations/sample-data";
import { buildInvoiceLedgerView } from "./view-models";

export function InvoiceLedgerPreview() {
  const view = buildInvoiceLedgerView(sampleInvoice);

  return (
    <section className="plain-card" aria-label="Invoice allocation ledger preview">
      <div className="section-heading compact">
        <p className="eyebrow">Invoice ledger · DTO-derived</p>
        <h2>{view.statusLabel} · {view.progressLabel}</h2>
        <p>{view.receiptBoundary}</p>
      </div>

      <div className="card-grid two">
        <article className="mini-panel">
          <span className="status-pill success">Deposit allocation</span>
          <dl className="summary-list">
            {view.ledgerRows.map((row) => (
              <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>
            ))}
          </dl>
        </article>
        <article className="mini-panel">
          <span className="status-pill attention">Receipt gated</span>
          <h3>{view.nextAction}</h3>
          <p>Receipt visibility is derived from invoice status and balance only, not from a mocked checkout screen.</p>
        </article>
      </div>
    </section>
  );
}
