import { sampleInvoice } from "@/features/operations/sample-data";
import {
  buildPlatformBillingView,
  type PlatformPlanFixture,
} from "./view-models";

const samplePlan: PlatformPlanFixture = {
  planCode: "V1_TRIAL",
  state: "TRIAL",
  renewalAt: "2026-11-01T00:00:00.000Z",
  providerMode: "SANDBOX",
};

export function PlatformBillingPreview() {
  const view = buildPlatformBillingView({
    plan: samplePlan,
    customerInvoice: sampleInvoice,
  });

  return (
    <section className="plain-card" aria-label="Platform billing boundary preview">
      <div className="section-heading compact">
        <p className="eyebrow">Platform billing · fixture boundary</p>
        <h2>Subscription status stays separate from customer cleaning payments</h2>
        <p>{view.boundaryNotice}</p>
        <span className="status-pill attention">{view.releaseLabel}</span>
      </div>

      <div className="card-grid two">
        <article className="mini-panel">
          <p className="label">Platform plan</p>
          <h3>{view.platformPlanLabel}</h3>
          <p>Renewal: {view.renewalLabel}</p>
          <p>Data source: {view.dataSource}</p>
        </article>

        <article className="mini-panel">
          <p className="label">Customer cleaning invoice</p>
          <h3>{view.customerPaymentLabel}</h3>
          <p>Outstanding customer balance: {view.customerBalanceLabel}</p>
          <p>This balance does not affect the ServiceDesk platform-plan state.</p>
        </article>
      </div>
    </section>
  );
}
