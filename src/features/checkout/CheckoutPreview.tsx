import type { InvoiceDTO, QuoteDTO, SlotDTO, VisitDTO } from "@/contracts";
import { buildCheckoutView, type CheckoutProviderMode } from "./view-models";

interface CheckoutPreviewProps {
  quote: QuoteDTO;
  slot: SlotDTO;
  visit: VisitDTO;
  invoice: InvoiceDTO;
  paymentMode: CheckoutProviderMode;
  holdExpiresAt: string;
}

export function CheckoutPreview(props?: CheckoutPreviewProps) {
  if (!props) {
    return (
      <section className="checkout-panel" aria-label="Customer checkout state preview">
        <div>
          <p className="eyebrow">Checkout state · server data required</p>
          <h2>Checkout waits for authoritative quote, slot, visit and invoice DTOs.</h2>
          <p>No hosted checkout command or provider receipt is exposed from this reusable component.</p>
        </div>
        <button
          className="button-primary full"
          type="button"
          disabled
          aria-disabled="true"
          title="Server-backed checkout preview only; hosted checkout command is not integrated on this branch."
        >
          Checkout unavailable · preview
        </button>
      </section>
    );
  }

  const view = buildCheckoutView({
    quote: props.quote,
    slot: props.slot,
    visit: props.visit,
    invoice: props.invoice,
    paymentMode: props.paymentMode,
    holdExpiresAt: props.holdExpiresAt,
  });

  return (
    <section className="checkout-panel" aria-label="Customer checkout state preview">
      <div>
        <p className="eyebrow">Checkout state · {props.paymentMode.toLowerCase()} sample</p>
        <h2>Accept quote, hold slot, collect deposit, then confirm visit.</h2>
        <p>{view.warning}</p>
      </div>
      <div className="checkout-steps" role="list" aria-label="Checkout steps">
        <article role="listitem" className="plain-card">
          <span className="status-pill success">Quote</span>
          <h3>{view.quoteState}</h3>
          <p>Deposit {view.depositLabel}; balance {view.balanceLabel}</p>
        </article>
        <article role="listitem" className="plain-card">
          <span className="status-pill attention">Slot</span>
          <h3>{view.slotState}</h3>
          <p>{view.holdLabel}</p>
        </article>
        <article role="listitem" className="plain-card">
          <span className="status-pill pending">Payment</span>
          <h3>{view.paymentState}</h3>
          <p>{view.canShowReceipt ? "Verified receipt can be shown." : "Receipt hidden until verified callback evidence exists."}</p>
        </article>
        <article role="listitem" className="plain-card">
          <span className="status-pill pending">Visit</span>
          <h3>{view.visitState}</h3>
          <button
            className="button-primary full"
            type="button"
            disabled
            aria-disabled="true"
            title="Sandbox preview only; hosted checkout command is not integrated on this branch."
          >
            {view.primaryAction} · sandbox preview
          </button>
        </article>
      </div>
    </section>
  );
}
