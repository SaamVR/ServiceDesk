import {
  sampleConversation,
  sampleInvoice,
  sampleQuote,
  sampleRequest,
  sampleVisit,
} from "@/features/operations/sample-data";
import { buildCrmCustomerView } from "./view-models";

export function CrmPreview() {
  const view = buildCrmCustomerView({
    request: sampleRequest,
    quote: sampleQuote,
    visit: sampleVisit,
    invoice: sampleInvoice,
    conversation: sampleConversation,
  });

  return (
    <section className="plain-card" aria-label="Staff CRM customer context preview">
      <span className="status-pill pending">{view.source.replace("_", " ").toLowerCase()}</span>
      <h2>Customer context</h2>
      <div className="card-grid two">
        <article className="mini-panel">
          <p className="label">Customer</p>
          <h3>{view.customerLabel}</h3>
          <p>{view.propertyLabel}</p>
          <p>{view.lastContactLabel}</p>
        </article>
        <article className="mini-panel">
          <p className="label">Request</p>
          <h3>{view.requestSummary}</h3>
          <p>{view.quoteSummary}</p>
          <p>{view.visitSummary}</p>
        </article>
        <article className="mini-panel">
          <p className="label">Money</p>
          <h3>{view.financialSummary}</h3>
          <p>Collections remain invoice-led and callback verified.</p>
        </article>
        <article className="mini-panel">
          <p className="label">Next actions</p>
          <ul className="check-list">
            {view.nextActions.map((action) => <li key={action}>{action}</li>)}
          </ul>
        </article>
      </div>
      <p>{view.boundaryNotice}</p>
    </section>
  );
}
