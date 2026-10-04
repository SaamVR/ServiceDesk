import type { ConversationDTO, InvoiceDTO, QuoteDTO, RequestDTO, VisitDTO } from "@/contracts";
import { buildCrmCustomerView } from "./view-models";

interface CrmPreviewProps {
  request: RequestDTO;
  quote: QuoteDTO;
  visit: VisitDTO;
  invoice: InvoiceDTO;
  conversation: ConversationDTO;
}

export function CrmPreview(props?: CrmPreviewProps) {
  if (!props) {
    return (
      <section className="plain-card" aria-label="Staff CRM customer context preview">
        <span className="status-pill pending">server data required</span>
        <h2>Customer context waits for an authoritative snapshot.</h2>
        <p>CRM panels must be populated by future readWorkspaceSnapshot/property reads before production use.</p>
      </section>
    );
  }

  const view = buildCrmCustomerView({
    request: props.request,
    quote: props.quote,
    visit: props.visit,
    invoice: props.invoice,
    conversation: props.conversation,
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
