import { sampleIntegrations } from "@/features/operations/sample-data";
import {
  buildConnectorOperationsView,
  type ConnectorEvidenceSample,
} from "./view-models";

const fixtureEvidence: ConnectorEvidenceSample[] = [
  {
    stage: "WHATSAPP_INBOUND",
    label: "WhatsApp inbound",
    state: "OBSERVED_FIXTURE",
    detail: "Webhook parsing is represented by fixture data only. No live inbound provider receipt is claimed.",
  },
  {
    stage: "WHATSAPP_OUTBOUND_POLICY",
    label: "WhatsApp outbound policy",
    state: "POLICY_ONLY",
    detail: "Session/template policy is visible to staff, but this product lane does not send provider messages.",
  },
  {
    stage: "WHATSAPP_STATUS",
    label: "Accepted → delivered → read",
    state: "NO_PROVIDER_RECEIPT",
    detail: "Delivery states remain distinct; provider accepted is never rendered as delivered or read.",
  },
  {
    stage: "CALENDAR",
    label: "Calendar availability",
    state: "NO_PROVIDER_RECEIPT",
    detail: "Availability freshness and conflict UI are implemented, while provider event proof remains unavailable.",
  },
  {
    stage: "PAYMENT",
    label: "Payment callback",
    state: "SANDBOX_ONLY",
    detail: "Checkout and invoice UI can display sandbox/sample state, not production payment success.",
  },
  {
    stage: "RECOVERY",
    label: "Operational recovery",
    state: "OBSERVED_FIXTURE",
    detail: "Failed-send, stale-calendar and payment-review recovery are modeled as isolated showcase states.",
  },
];

export function ConnectorOperationsPreview() {
  const view = buildConnectorOperationsView({
    integrations: sampleIntegrations,
    evidence: fixtureEvidence,
  });

  return (
    <section className="plain-card" aria-label="Connector operations evidence">
      <div className="section-heading compact">
        <p className="eyebrow">Connector operations · product-side evidence</p>
        <h2>Provider state stays separate from UI proof</h2>
        <p>
          This sequence mirrors operational handoffs without claiming provider verification from fixture,
          sandbox, or policy-only states.
        </p>
        <span className="status-pill attention">{view.releaseLabel}</span>
      </div>

      <ol className="connector-steps">
        {view.steps.map((step, index) => (
          <li className="connector-step" key={step.stage}>
            <div className="connector-step-number" aria-hidden="true">{index + 1}</div>
            <div>
              <div className="connector-step-heading">
                <h3>{step.label}</h3>
                <span className={`status-pill ${step.tone}`}>{step.proofLabel}</span>
              </div>
              <p>{step.detail}</p>
              {step.integrationStatus && (
                <p className="connector-provider-state">
                  Configured status: <strong>{step.integrationStatus}</strong>
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
