import { sampleQuote, sampleRequest } from "@/features/operations/sample-data";
import { buildEditableRequestSummary } from "./view-models";

export function RequestSummaryPreview() {
  const view = buildEditableRequestSummary({ request: sampleRequest, quote: sampleQuote });

  return (
    <aside className="plain-card" aria-label="Editable request summary preview">
      <span className="status-pill pending">Fixture summary</span>
      <h2>{view.title}</h2>
      <p>{view.versionLabel} · {view.statusLabel}</p>
      <dl className="summary-list">
        {view.editableFields.map((field) => (
          <div key={field.key}><dt>{field.label}</dt><dd>{field.value}</dd></div>
        ))}
        <div><dt>Price</dt><dd>{view.totalLabel}</dd></div>
        <div><dt>Deposit</dt><dd>{view.depositLabel}</dd></div>
        <div><dt>Duration</dt><dd>{view.durationLabel}</dd></div>
      </dl>
      <button
        className="button-secondary full"
        type="button"
        disabled
        aria-disabled="true"
        title="Fixture preview only; ServiceDeskFacade.updateRequest is not integrated on this branch."
      >
        {view.primaryAction} · preview
      </button>
      <p>{view.boundaryNotice}</p>
    </aside>
  );
}
