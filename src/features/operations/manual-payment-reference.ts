/** A staff-supplied payment reference is external evidence, never a log
 * transport or an idempotency authority. Preserve printable banking refs
 * while rejecting oversized/control-laden values before any protected RPC.
 */
export function normalizeStaffPaymentReference(input: unknown): string | undefined {
  if (typeof input !== "string") return undefined;
  const reference = input.trim();
  if (!reference || reference.length > 160 ||
      /[\x00-\x1f\x7f-\x9f\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/u.test(reference)) return undefined;
  return reference;
}
