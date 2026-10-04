export interface EnquiryFormValues {
  serviceLabel: string;
  bedroomsLabel: string;
  bathroomsLabel: string;
  requestedStartLabel: string;
}

interface EnquiryFormProps {
  values: EnquiryFormValues;
  modeLabel?: string;
  submitLabel?: string;
  disabledReason?: string;
  boundaryNotice?: string;
}

export function EnquiryForm({
  values,
  modeLabel = "Fixture intake",
  submitLabel = "Continue request",
  disabledReason = "Fixture preview only; create/update request command is not integrated on this branch.",
  boundaryNotice = "This form is read-only until Chat 1 accepts the request create/update server boundary.",
}: EnquiryFormProps) {
  return (
    <form className="plain-card" aria-label="Cleaning enquiry form" data-source="fixture-ui-only">
      <span className="status-pill pending">{modeLabel}</span>
      <h2>Start a cleaning request</h2>
      <label className="form-field">Service <input readOnly value={values.serviceLabel} /></label>
      <label className="form-field">Bedrooms <input readOnly value={values.bedroomsLabel} /></label>
      <label className="form-field">Bathrooms <input readOnly value={values.bathroomsLabel} /></label>
      <label className="form-field">Preferred date <input readOnly value={values.requestedStartLabel} /></label>
      <button
        className="button-primary full"
        type="button"
        disabled
        aria-disabled="true"
        title={disabledReason}
      >
        {submitLabel} · preview
      </button>
      <p>{boundaryNotice}</p>
    </form>
  );
}
