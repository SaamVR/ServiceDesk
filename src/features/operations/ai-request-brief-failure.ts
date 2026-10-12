/**
 * Operator-facing explanation of a failed protected request-brief call.
 * Codes are server-owned; never print untrusted provider errors, model text,
 * a workspace identifier, customer details, or a raw response payload.
 */
const known: Readonly<Record<string, string>> = Object.freeze({
  AI_RUNTIME_DISABLED:
    "AI is disabled for this workspace deployment. Manual intake and quoting remain available.",
  AI_RUNTIME_CONFIGURATION_INCOMPLETE:
    "The AI model is not configured. Ask the workspace owner to review the AI connection in Settings.",
  AI_RUNTIME_ORIGIN_INVALID:
    "The AI connection needs an approved provider endpoint. Ask the owner to review Settings.",
  AI_MODEL_CONFIGURATION_BLOCKED:
    "The configured model connection was rejected. Ask the owner to review its credentials and endpoint.",
  AI_MODEL_RATE_LIMITED:
    "The AI provider has reached a rate limit. Try again later, or continue with the saved request.",
  AI_MODEL_TIMEOUT:
    "The AI provider did not respond within the time limit. Retry if needed; the request was not changed.",
  AI_MODEL_TRANSIENT_FAILURE:
    "The AI provider is temporarily unavailable. Continue with the saved request or try again later.",
  AI_MODEL_NETWORK_FAILURE:
    "The model connection could not be reached. Continue manually or try again later.",
  AI_BRIEF_CANCELLED:
    "The AI briefing was cancelled. No request, quote or customer record was changed.",
  AI_BRIEF_AUTH_REQUIRED:
    "Sign in with an active staff account before generating a request brief.",
  AI_BRIEF_AUTH_UNAVAILABLE:
    "The staff session could not be verified. Refresh or sign in again.",
  AI_BRIEF_FORBIDDEN:
    "You cannot generate AI for this request or branch. Check your selected workspace access.",
  AI_BRIEF_NOT_FOUND:
    "The saved cleaning request is no longer available. Refresh Requests.",
  AI_BRIEF_READ_FAILED:
    "Saved request details could not be checked. Refresh Requests before retrying.",
  AI_BRIEF_SERVICE_INVALID:
    "The request refers to invalid service details. Review the saved request before retrying.",
  AI_BRIEF_SERVICE_NOT_FOUND:
    "The request's cleaning service is unavailable. Review its saved service selection.",
  AI_BRIEF_SERVICE_READ_FAILED:
    "Saved service details could not be checked. Retry once the catalog is available.",
  AI_MODEL_INVALID_RESPONSE:
    "The model did not return a safe usable brief. Continue manually; no customer action occurred.",
  AI_BRIEF_UNAVAILABLE:
    "The AI briefing service is unavailable. Manual request handling remains available.",
});
const fallback = "AI couldn't prepare a verified request brief. Use the saved request details instead.";

export function describeAiRequestBriefFailure(code: unknown, status?: number): string {
  if (typeof code === "string" && Object.prototype.hasOwnProperty.call(known, code)) {
    return known[code];
  }
  if (status === 401) return known.AI_BRIEF_AUTH_REQUIRED;
  if (status === 403) return known.AI_BRIEF_FORBIDDEN;
  if (status === 404) return known.AI_BRIEF_NOT_FOUND;
  if (status === 429) return known.AI_MODEL_RATE_LIMITED;
  return fallback;
}
