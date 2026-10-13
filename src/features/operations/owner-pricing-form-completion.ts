/** Presentational completeness only. The server still validates and persists prices. */
export interface OwnerRequiredFieldState {
  required: boolean;
  valid: boolean;
  disabled?: boolean;
}
export function summarizeOwnerPricingCompletion(fields: readonly OwnerRequiredFieldState[]) {
  const required = fields.filter(f => f.required && !f.disabled);
  return {
    completed: required.filter(f => f.valid).length,
    total: required.length,
    remaining: required.filter(f => !f.valid).length,
  };
}
