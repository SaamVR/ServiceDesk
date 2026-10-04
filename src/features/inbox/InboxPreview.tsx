import { buildInboxThreadView, type TemporaryInboxMessage } from "./view-models";

const sampleMessages: TemporaryInboxMessage[] = [
  {
    id: "msg_inbound_change",
    direction: "INBOUND",
    authorLabel: "Customer",
    body: "Can I move the visit to Friday morning?",
    occurredAt: "2026-10-04T06:18:00.000Z",
  },
  {
    id: "msg_provider_accepted",
    direction: "OUTBOUND",
    authorLabel: "Dispatcher",
    body: "I am checking the crew schedule before confirming.",
    deliveryState: "PROVIDER_ACCEPTED",
    occurredAt: "2026-10-04T06:20:00.000Z",
  },
  {
    id: "msg_delivery_failed",
    direction: "OUTBOUND",
    authorLabel: "System",
    body: "Reminder send failed and needs reconciliation.",
    deliveryState: "FAILED",
    occurredAt: "2026-10-04T06:25:00.000Z",
  },
];

const sampleThread = buildInboxThreadView({
  id: "thread_showcase_001",
  customerLabel: "Sample customer",
  requestLabel: "MOVE_OUT · QUOTED",
  handoverActive: true,
  messages: sampleMessages,
});

export function InboxPreview() {
  return (
    <div className="inbox-preview" aria-label="Shared inbox delivery state preview">
      <div className="inbox-thread-list">
        <p className="label">Threads</p>
        <button className="list-row active">{sampleThread.customerLabel}</button>
        <button className="list-row">Delivery uncertain</button>
        <button className="list-row">Crew absence</button>
      </div>
      <section className="inbox-conversation" aria-labelledby="inbox-preview-heading">
        <p className="label">Shared inbox</p>
        <h3 id="inbox-preview-heading">{sampleThread.requestLabel}</h3>
        <p>{sampleThread.statusSummary}</p>
        {sampleThread.messages.map((message) => (
          <article className={`message-card ${message.direction.toLowerCase()}`} key={message.id}>
            <div>
              <strong>{message.authorLabel}</strong>
              <p>{message.body}</p>
            </div>
            <span className={`status-pill ${message.tone}`}>{message.deliveryLabel}</span>
          </article>
        ))}
      </section>
      <aside className="inbox-context">
        <p className="label">Context</p>
        <ul className="check-list">
          <li>Provider accepted is not delivery proof.</li>
          <li>Failed delivery creates staff recovery work.</li>
          <li>Human handover blocks automatic replies.</li>
        </ul>
      </aside>
    </div>
  );
}
