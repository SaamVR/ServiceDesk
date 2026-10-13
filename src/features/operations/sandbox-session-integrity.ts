/** A stored checkout row is not evidence of payment or customer ownership.
 * Validate its immutable shape before displaying or completing either flow.
 * The caller must separately authenticate and scope workspace/customer rows.
 */
export function verifiedSandboxSessionShape(row: Record<string, unknown>): boolean {
  const uuid = (value: unknown): value is string =>
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  if (!uuid(row.id) || !uuid(row.workspace_id) || !uuid(row.customer_id) ||
      !uuid(row.quote_id) || !["BALANCE", "DEPOSIT"].includes(String(row.purpose)) ||
      !["OPEN", "APPLIED", "DUPLICATE", "PAYMENT_REVIEW", "EXPIRED", "CANCELLED"].includes(String(row.status)) ||
      typeof row.expires_at !== "string" || !Number.isFinite(Date.parse(row.expires_at)) ||
      typeof row.amount_minor !== "number" || !Number.isSafeInteger(row.amount_minor) ||
      row.amount_minor <= 0 ||
      typeof row.currency !== "string" || !/^[A-Z]{3}$/.test(row.currency)) return false;
  if (row.purpose === "DEPOSIT") return uuid(row.hold_id);
  return uuid(row.invoice_id);
}
