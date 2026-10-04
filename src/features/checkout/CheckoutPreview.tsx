import { buildCheckoutView } from "./view-models";
import { sampleInvoice, sampleQuote, sampleSlot, sampleVisit } from "@/features/operations/sample-data";

export function CheckoutPreview() {
  const view = buildCheckoutView({
    quote: { ...sampleQuote, status: "ACCEPTED" },
    slot: { ...sampleSlot, availabilityFresh: true },
    visit: { ...sampleVisit, status: "AWAITING_PAYMENT" },
    invoice: sampleInvoice,
    paymentMode: "SANDBOX",
    holdExpiresAt: "2026-10-04T06:30:00.000Z",
  });

  return (
    <section className="checkout-panel" aria-label="Customer checkout state preview">
      <div>
        <p className="eyebrow">Checkout state · sandbox sample</p>
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
