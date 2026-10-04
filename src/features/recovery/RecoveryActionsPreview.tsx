import {
  sampleAttentionItems,
  sampleIntegrations,
  sampleVisit,
} from "@/features/operations/sample-data";
import {
  buildRecoveryActionsView,
  type RecoveryFixture,
} from "./view-models";

const recoveryFixtures: RecoveryFixture[] = [
  {
    id: "recovery_delivery_001",
    kind: "DELIVERY_UNCERTAIN",
    resourceId: "conv_showcase_001",
    state: "RECONCILE_REQUIRED",
    ownerUserId: "dispatcher_1",
    summary: "Provider accepted a message in fixture history, but recipient delivery is not proven.",
  },
  {
    id: "recovery_calendar_001",
    kind: "CALENDAR_STALE",
    resourceId: "slot_showcase_001",
    state: "RECONNECT_REQUIRED",
    ownerUserId: "dispatcher_1",
    summary: "Calendar freshness is stale, so instant confirmation remains blocked.",
  },
  {
    id: "recovery_payment_001",
    kind: "PAYMENT_REVIEW",
    resourceId: sampleVisit.id,
    state: "HUMAN_REVIEW_REQUIRED",
    ownerUserId: "dispatcher_1",
    summary: "Late payment after hold expiry requires staff review of capacity before confirmation.",
  },
];

export function RecoveryActionsPreview() {
  const view = buildRecoveryActionsView({
    attentionItems: sampleAttentionItems,
    integrations: sampleIntegrations,
    recoveryFixtures,
  });

  return (
    <div className="site-shell">
      <section className="plain-card" aria-label="Recovery actions preview">
        <div className="section-heading compact">
          <p className="eyebrow">Recovery queue · fixture UI</p>
          <h2>Failures become owned, explicit next actions</h2>
          <p>
            Retry is never automatic when provider delivery is uncertain, calendar freshness is stale,
            or payment/capacity state needs human review.
          </p>
          <span className="status-pill attention">{view.releaseLabel}</span>
        </div>

        <div className="card-grid three">
          {view.items.map((item) => (
            <article className="mini-panel" key={item.id}>
              <span className="status-pill pending">{item.proofLabel}</span>
              <h3>{item.kind.replaceAll("_", " ")}</h3>
              <p>{item.summary}</p>
              <dl className="summary-list">
                <div><dt>Owner</dt><dd>{item.ownerLabel}</dd></div>
                <div><dt>Linked attention</dt><dd>{item.linkedAttentionCount}</dd></div>
                <div><dt>Provider</dt><dd>{item.providerStatus ?? "No configured status"}</dd></div>
              </dl>
              <button className="button-secondary full" type="button">
                {item.action}
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
