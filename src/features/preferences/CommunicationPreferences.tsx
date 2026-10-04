import { sampleConversation, sampleIntegrations } from "@/features/operations/sample-data";
import { buildCommunicationPreferenceView } from "./view-models";

export function CommunicationPreferences() {
  const view = buildCommunicationPreferenceView({
    conversation: sampleConversation,
    integrations: sampleIntegrations,
  });

  return (
    <section className="plain-card" aria-label="Communication preferences preview">
      <span className="status-pill pending">{view.source.replaceAll("_", " ").toLowerCase()}</span>
      <h2>Communication preferences</h2>
      <p>{view.consentLabel}</p>
      <p>{view.quietHoursLabel}</p>
      <div className="card-grid three">
        {view.options.map((option) => (
          <article className="mini-panel" key={option.channel}>
            <span className={`status-pill ${option.available ? "success" : "pending"}`}>
              {option.selected ? "Current" : option.available ? "Available" : "Blocked"}
            </span>
            <h3>{option.label}</h3>
            <p>{option.reason}</p>
          </article>
        ))}
      </div>
      <p>{view.boundaryNotice}</p>
    </section>
  );
}
