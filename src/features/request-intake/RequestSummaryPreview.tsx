import type { QuoteDTO, RequestDTO } from "@/contracts";
import { buildEditableRequestSummary } from "./view-models";

interface RequestSummaryPreviewProps {
  request: RequestDTO;
  quote: QuoteDTO;
  modeLabel?: string;
  actionSuffix?: string;
  actionTitle?: string;
}

export function RequestSummaryPreview({
  request,
  quote,
  modeLabel = "Request summary",
  actionSuffix = "preview",
  actionTitle = "Preview only; ServiceDeskFacade.updateRequest is not integrated on this branch.",
}: RequestSummaryPreviewProps) {
  const view = buildEditableRequestSummary({ request, quote });

  return (
    <aside className="plain-card" aria-label="Editable request summary preview">
      <span className="status-pill pending">{modeLabel}</span>
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
        title={actionTitle}
      >
        {view.primaryAction} · {actionSuffix}
      </button>
      <p>{view.boundaryNotice}</p>
    </aside>
  );
}
