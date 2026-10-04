export type GoogleCalendarRecoveryClass = "RETRYABLE" | "TERMINAL_CONFIG" | "OPERATOR_REVIEW" | "FULL_REBUILD_REQUIRED";

const retryableCodes = new Set(["TIMEOUT", "NETWORK_ERROR", "RATE_LIMITED", "TOO_MANY_REQUESTS", "HTTP_429", "HTTP_500", "HTTP_502", "HTTP_503", "HTTP_504", "CALENDAR_RATE_LIMITED", "CALENDAR_SERVER_ERROR"]);
const configCodes = new Set(["UNAUTHORIZED", "FORBIDDEN", "AUTHENTICATION_FAILED", "CALENDAR_NOT_CONFIGURED", "CALENDAR_DISCONNECTED", "CALENDAR_REAUTH_REQUIRED", "CONFIGURATION_MISSING", "CONFIGURATION_INVALID"]);
const reviewCodes = new Set(["INVALID_PROVIDER_EVENT_MAPPING", "OPERATOR_REVIEW_REQUIRED", "PROVIDER_EVENT_MISSING", "PROVIDER_EVENT_CANCELLED", "PROVIDER_EVENT_ID_MISMATCH", "EXTERNAL_EDIT"]);
const rebuildCodes = new Set(["CALENDAR_SYNC_TOKEN_EXPIRED", "SYNC_TOKEN_EXPIRED", "FULL_REBUILD_REQUIRED"]);

export function classifyGoogleCalendarRecovery(code: string): GoogleCalendarRecoveryClass {
  const normalized = code.trim().toUpperCase();
  if (retryableCodes.has(normalized)) return "RETRYABLE";
  if (configCodes.has(normalized)) return "TERMINAL_CONFIG";
  if (reviewCodes.has(normalized)) return "OPERATOR_REVIEW";
  if (rebuildCodes.has(normalized)) return "FULL_REBUILD_REQUIRED";
  return "OPERATOR_REVIEW";
}
