/** A matching amount alone is not authorization to reuse an existing
 * checkout URL. The stored source identity, purpose and expiry must match
 * the current customer-owned accepted quote/invoice.
 */
export function isReusableBalanceSession(
  saved: Record<string, unknown> | null,
  expected: { quoteId: string; invoiceId: string; amountMinor: number; currency: string; nowMs: number },
): saved is Record<string, unknown> {
  return !!saved &&
    typeof saved.id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(saved.id) &&
    saved.purpose === "BALANCE" && saved.status === "OPEN" &&
    saved.quote_id === expected.quoteId && saved.invoice_id === expected.invoiceId &&
    typeof saved.amount_minor === "number" && Number.isSafeInteger(saved.amount_minor) &&
    saved.amount_minor > 0 && saved.amount_minor === expected.amountMinor &&
    saved.currency === expected.currency &&
    typeof saved.expires_at === "string" && Number.isFinite(Date.parse(saved.expires_at)) &&
    Date.parse(saved.expires_at) > expected.nowMs;
}
