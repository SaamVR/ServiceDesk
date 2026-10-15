/** An invoice may be fully paid between a staff submission and browser retry.
 * Never call it a duplicate based only on PAID status; require the exact
 * tenant-scoped persisted manual-payment record and reconciled invoice ledger.
 */
export function verifiedManualPaymentReplay(
  invoice: Record<string, unknown>,
  record: Record<string, unknown> | null,
  expected: {
    workspaceId: string;
    invoiceId: string;
    currency: string;
    amountMinor: number;
    method: "CASH" | "BANK_TRANSFER" | "OTHER";
    reference: string;
    idempotencyKey: string;
  },
): boolean {
  if (!record ||
      invoice.status !== "PAID" || invoice.currency !== expected.currency ||
      invoice.balance_minor !== 0 ||
      typeof invoice.total_minor !== "number" ||
      typeof invoice.allocated_minor !== "number" ||
      typeof invoice.refunded_minor !== "number" ||
      ![invoice.total_minor, invoice.allocated_minor, invoice.refunded_minor].every(
        n => Number.isSafeInteger(n) && n >= 0,
      ) ||
      invoice.total_minor <= 0 ||
      invoice.allocated_minor < invoice.refunded_minor ||
      invoice.allocated_minor - invoice.refunded_minor !== invoice.total_minor) return false;

  return record.workspace_id === expected.workspaceId &&
    record.invoice_id === expected.invoiceId &&
    record.currency === expected.currency &&
    record.amount_minor === expected.amountMinor &&
    record.method === expected.method &&
    record.reference === expected.reference &&
    record.idempotency_key === expected.idempotencyKey &&
    typeof record.id === "string" &&
    /^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(record.id) &&
    typeof record.ledger_entry_id === "string" &&
    /^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(record.ledger_entry_id);
}
