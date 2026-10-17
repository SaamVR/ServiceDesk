/** Accept only the narrow successful synthetic model-probe contract.
 * Never treat configuration presence, arbitrary JSON or HTTP 200 alone as proof.
 */
export interface VerifiedOwnerModelProbe {
  state: "PROVIDER_RESPONDED_TO_CONTROLLED_PROBE";
  model: string;
  checkedAt: string;
  source: "REAL_MODEL_RESPONSE_NOT_A_PROVIDER_DELIVERY";
  durableReceipt: false;
}

export function parseOwnerModelProbe(value: unknown): VerifiedOwnerModelProbe | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (v.state !== "PROVIDER_RESPONDED_TO_CONTROLLED_PROBE" ||
      v.source !== "REAL_MODEL_RESPONSE_NOT_A_PROVIDER_DELIVERY" ||
      v.durableReceipt !== false ||
      typeof v.model !== "string" || !v.model.trim() ||
      v.model.length > 120 || /[\r\n\x00-\x1f]/.test(v.model) ||
      typeof v.checkedAt !== "string" || !v.checkedAt.trim() ||
      !Number.isFinite(Date.parse(v.checkedAt))) return null;
  // Only known safe fields pass to UI. Discard any untrusted extra payload.
  return {
    state: "PROVIDER_RESPONDED_TO_CONTROLLED_PROBE",
    model: v.model,
    checkedAt: v.checkedAt,
    source: "REAL_MODEL_RESPONSE_NOT_A_PROVIDER_DELIVERY",
    durableReceipt: false,
  };
}

/** Operator-safe diagnostics; never echo response bodies or provider secrets. */
export function describeOwnerModelProbeFailure(status: number): string {
  if (status === 401 || status === 403)
    return "AI model test was not authorized for this owner or workspace. Check access and private gateway authorization.";
  if (status === 408 || status === 504)
    return "The AI model test timed out. Retry only when needed; no business action was authorized.";
  if (status === 429)
    return "AI usage is currently rate-limited. Avoid rapid retries and check the provider quota.";
  if (status === 502 || status === 503)
    return "The configured AI service is unavailable. Ordinary ServiceDesk workflows remain usable.";
  if (status === 400 || status === 422)
    return "The AI test configuration was rejected. Check the approved server-side model settings.";
  return "The AI model test could not be verified. Check protected server logs and configuration.";
}
