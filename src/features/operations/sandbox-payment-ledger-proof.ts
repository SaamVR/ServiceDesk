/** Session flags alone cannot establish that a customer's payment was applied.
 * A saved sandbox result must match the independently committed verified
 * payment application in the same workspace, down to payment identity.
 */
export function verifiedSandboxPaymentLedgerMatch(
  session: Record<string, unknown>,
  application: Record<string, unknown> | null,
): boolean {
  if (!application || typeof session.id !== "string") return false;
  const compact = session.id.replaceAll("-", "");
  const eventId = "evt_sd_demo_" + compact;
  const transactionId = "pi_sd_demo_" + compact;
  const purpose = session.purpose;
  if (!/^[a-f0-9]{32}$/i.test(compact) ||
      (purpose !== "BALANCE" && purpose !== "DEPOSIT") ||
      session.provider_event_id !== eventId ||
      session.provider_transaction_id !== transactionId ||
      application.workspace_id !== session.workspace_id ||
      application.provider !== "STRIPE" ||
      application.provider_account_id !== "acct_servicedesk_internal_sandbox" ||
      application.provider_event_id !== eventId ||
      application.provider_transaction_id !== transactionId ||
      application.state !== "APPLIED" || application.purpose !== purpose ||
      application.quote_id !== session.quote_id ||
      application.currency !== session.currency ||
      typeof session.amount_minor !== "number" ||
      !Number.isSafeInteger(session.amount_minor) ||
      application.amount_minor !== session.amount_minor) return false;
  return purpose === "DEPOSIT"
    ? application.hold_id === session.hold_id
    : application.invoice_id === session.invoice_id;
}
