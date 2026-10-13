/** A staff-supplied payment reference is external evidence, never a log
 * transport or an idempotency authority. Preserve printable banking refs
 * while rejecting oversized/control-laden values before any protected RPC.
 */
export function normalizeStaffPaymentReference(input: unknown): string | undefined {
  if (typeof input !== "string") return undefined;
  const reference = input.trim();
  if (!reference || reference.length > 160 ||
      /[\x00-\x1f\x7f\u202a-\u202e\u2066-\u2069]/iu.test(reference)) return undefined;
  return reference;
}
