import type { QuoteDTO, RequestDTO } from "@/contracts";
import { buildQuoteAcceptanceAvailability, type QuoteAcceptanceAvailability } from "./server-boundary";
import { buildQuoteApprovalView } from "./view-models";

interface CustomerQuotePreviewProps {
  request: RequestDTO;
  quote: QuoteDTO;
  acceptance?: QuoteAcceptanceAvailability;
  sourceLabel?: "SERVER_SNAPSHOT" | "FIXTURE_UI_ONLY";
}

export function CustomerQuotePreview({ request, quote, acceptance, sourceLabel = "SERVER_SNAPSHOT" }: CustomerQuotePreviewProps) {
  const view = buildQuoteApprovalView({ request, currentQuote: quote });
  const availability = acceptance ?? buildQuoteAcceptanceAvailability(quote, false);
  return (
    <section className="plain-card" aria-label="Customer quote acceptance boundary">
      <div className="section-heading compact">
        <p className="eyebrow">Customer quote · {sourceLabel}</p>
        <h2>{view.requestLabel}</h2>
        <p>Customer acceptance delegates to acceptQuote and never mutates quote status locally.</p>
      </div>
      <div className="card-grid two">
        <article className="mini-panel">
          <span className="status-pill success">Quote {quote.status.replaceAll("_", " ")}</span>
          <h3>{view.current.totalLabel}</h3>
          <p>Deposit {view.current.depositLabel}; balance {view.current.balanceLabel}; version {quote.version}.</p>
        </article>
        <article className="mini-panel">
          <span className="status-pill attention">Server command boundary</span>
          <h3>{availability.label}</h3>
          <p>{availability.disabledReason ?? "On success, Product renders the returned QuoteDTO before continuing to slots."}</p>
          <button className="button-primary full" type="button" disabled={!availability.enabled} aria-disabled={!availability.enabled}>{availability.pending ? "Accepting quote" : "Accept quote"}</button>
        </article>
      </div>
    </section>
  );
}
