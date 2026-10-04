import type { ConversationDTO, MessageDTO } from "@/contracts";
import type { ProductActionState } from "@/features/operations/action-state";
import { buildInboxThreadView, type InboxActionAvailability } from "./view-models";

interface InboxPreviewProps {
  conversation: ConversationDTO;
  messages: MessageDTO[];
  customerLabel: string;
  requestLabel: string;
  actionAvailability?: InboxActionAvailability;
  actionState?: ProductActionState;
  fixtureLabel?: string;
}

export function InboxPreview({
  conversation,
  messages,
  customerLabel,
  requestLabel,
  actionAvailability,
  actionState,
  fixtureLabel,
}: InboxPreviewProps) {
  const thread = buildInboxThreadView({
    conversation,
    messages,
    customerLabel,
    requestLabel,
    actionAvailability,
    actionState,
  });

  return (
    <div className="inbox-preview" aria-label="Shared inbox delivery state preview" data-source={fixtureLabel ?? "SERVER_SNAPSHOT"}>
      <div className="inbox-thread-list">
        <p className="label">Threads · {fixtureLabel ?? "server snapshot"}</p>
        <button className="list-row active" type="button" disabled aria-disabled="true" title="No thread selection command is wired on this fixture; the route-local server snapshot selects the active thread.">{thread.customerLabel}</button>
        <button className="list-row" type="button" disabled aria-disabled="true" title="Server snapshot required before selecting another thread.">Delivery uncertain</button>
        <button className="list-row" type="button" disabled aria-disabled="true" title="Server snapshot required before selecting another thread.">Crew absence</button>
      </div>
      <section className="inbox-conversation" aria-labelledby="inbox-preview-heading">
        <p className="label">Shared inbox · {thread.handoverLabel}</p>
        <h3 id="inbox-preview-heading">{thread.requestLabel}</h3>
        <p>{thread.statusSummary}</p>
        {thread.messages.map((message) => (
          <article className={`message-card ${message.direction.toLowerCase()}`} key={message.id}>
            <div><strong>{message.authorLabel}</strong><p>{message.body}</p></div>
            <span className={`status-pill ${message.tone}`}>{message.deliveryLabel}</span>
          </article>
        ))}
        <div className="action-row" aria-label="Inbox server actions">
          <button className="button-secondary" type="button" disabled={!thread.actionAvailability.handoverEnabled} aria-disabled={!thread.actionAvailability.handoverEnabled} title={thread.actionAvailability.disabledReason}>{thread.actionAvailability.handoverLabel}</button>
          <button className="button-primary" type="button" disabled={!thread.actionAvailability.replyEnabled} aria-disabled={!thread.actionAvailability.replyEnabled} title={thread.actionAvailability.disabledReason}>{thread.actionAvailability.replyLabel}</button>
        </div>
        {actionState && <p className="form-note">{actionState.message}</p>}
      </section>
      <aside className="inbox-context">
        <p className="label">Context</p>
        <ul className="check-list">
          <li>Provider accepted is not delivery proof.</li>
          <li>Failed or suppressed delivery creates staff recovery work.</li>
          <li>No handover or reply state changes locally before server success.</li>
        </ul>
      </aside>
    </div>
  );
}
