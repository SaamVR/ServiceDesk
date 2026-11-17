/**
 * The browser controls ?error=. Only known Server Action messages may be
 * displayed as a bounded ServiceDesk registration alert. This limits
 * arbitrary phishing text but a known message in a URL is NOT proof
 * that a Server Action actually produced that message.
 */
// These bounded messages describe an RPC that may already have committed.
const uncertainMessages = new Set([
  "Workspace registration may have committed, but its result could not be confirmed. Check your authorized workspaces before trying again.",
  "Workspace registration may have committed, but saved owner access could not be verified. Use your authorized workspaces to check before trying again.",
]);
const knownMessages = new Set([
  ...uncertainMessages,
  "Workspace registration is not enabled on this environment yet.",
  "Workspace creation is not configured on this environment.",
  "Workspace creation is limited to approved test accounts on this preview.",
  "Workspace setup is unavailable. Contact the administrator to complete deployment.",
  "Workspace creation is not approved for this account. Contact the administrator.",
  "This workspace address is taken. Try another.",
  "Verify your email before creating a workspace.",
  "Select another business timezone.",
  "Workspace could not be created. Check your details and try again.",
  "Business name must be between 2 and 120 characters.",
  "Workspace address must be 3–40 lowercase letters, numbers or single hyphens.",
  "Choose a supported business timezone.",
  "Choose a supported business currency.",
]);

const unrecognizedMessage = "Workspace setup could not be completed. Please try again or contact the administrator.";

export function trustedWorkspaceRegistrationError(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  return knownMessages.has(raw) ? raw : unrecognizedMessage;
}

/** Advisory recovery navigation; URL text does not prove a database commit. */
export function workspaceRegistrationNeedsReadback(raw: unknown): boolean {
  return typeof raw === "string" && uncertainMessages.has(raw);
}
