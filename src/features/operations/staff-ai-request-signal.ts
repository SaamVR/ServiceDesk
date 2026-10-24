/**
 * Bounds optional AI suggestion and staff approval network requests so a
 * stalled HTTP response cannot pin staff UI in a busy state forever.
 *
 * Browser cancellation is separate from server execution. In particular an
 * approval timeout does NOT imply that its idempotent reply was not queued.
 */
export const STAFF_AI_REQUEST_TIMEOUT_MS = 20_000;
// The approved private Codex test transport permits up to 60s model time.
// Allow network overhead for draft-only requests, NOT for reply approval.
export const STAFF_AI_DRAFT_TIMEOUT_MS = 75_000;

export function boundedStaffRequestSignal(
  controller: AbortController,
  timeoutMs: number = STAFF_AI_REQUEST_TIMEOUT_MS,
): AbortSignal {
  return AbortSignal.any([controller.signal, AbortSignal.timeout(timeoutMs)]);
}
