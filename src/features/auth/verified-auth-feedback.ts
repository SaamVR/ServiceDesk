/** URL parameters are not authenticated receipts from Server Actions.
 * Never display raw auth error text, and never claim a sign-out or password
 * change succeeded just because a query parameter says so.
 */
export type AuthFeedbackPage = "sign-in" | "sign-up" | "forgot-password" | "reset-password";

const errorMessages: Record<AuthFeedbackPage, ReadonlySet<string>> = {
  "sign-in": new Set([
    "Enter your email address and password.",
    "Sign in is temporarily unavailable.",
    "The email or password is incorrect.",
    "The verification link has expired or could not be confirmed. Please try signing in.",
    "Sign-in is unavailable", "Workspace lookup unavailable", "Account lookup unavailable",
  ]),
  "sign-up": new Set([
    "Account creation is not enabled on this environment yet.",
    "Account creation on this preview is currently limited to approved test accounts.",
    "Account creation is not configured on this environment yet.",
    "Enter a valid email address.", "Use a password between 12 and 128 characters.",
    "Review and accept the Terms and Privacy Policy.",
    "Please wait before requesting another confirmation email.",
    "We could not start account registration. Try again shortly.",
  ]),
  "forgot-password": new Set([
    "Enter a valid email address.",
    "Password recovery is unavailable in this environment.",
    "Your reset link is invalid or expired. Request another link.",
  ]),
  "reset-password": new Set([
    "Choose a new password between 12 and 128 characters.",
    "The two passwords do not match.",
    "Password recovery is unavailable in this environment.",
    "Password could not be updated. Please request a fresh recovery link.",
  ]),
};

const signInNotice: Readonly<Record<string, string>> = Object.freeze({
  "You have been signed out.": "If you recently signed out, you can sign in again to continue.",
  "Password updated. Sign in with your new password.":
    "If you changed your password, sign in using the new password.",
  "Verify your email and sign in to create a workspace.":
    "Verify your email before signing in to create a workspace.",
});

export function trustedAuthFeedback(
  page: AuthFeedbackPage, kind: "error" | "notice", raw: unknown,
): string | null {
  if (typeof raw !== "string" || !raw.length) return null;
  if (kind === "notice") {
    return page === "sign-in" && raw.length <= 300 && Object.hasOwn(signInNotice, raw)
      ? signInNotice[raw] : null;
  }
  return raw.length <= 300 && errorMessages[page].has(raw) ? raw
    : "We could not verify this error message. Please retry from this page.";
}
