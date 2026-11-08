/**
 * Signup verification notices arrive through an untrusted URL parameter.
 * Even a recognized message is only advice: URL text cannot prove an email
 * was sent or that an account exists. Unknown text is never reflected.
 */
export const RESEND_VERIFICATION_ADVISORY =
  "If this address has an account awaiting verification, a new link may arrive. Delivery is not confirmed; wait before trying again.";

const allowed: Readonly<Record<string, string>> = Object.freeze({
  "Account registration is not enabled on this environment.":
    "Account registration may be unavailable on this environment.",
  "Enter a valid email address to request a new verification message.":
    "Check the email address before trying again.",
  "Account registration on this preview is limited to approved test accounts.":
    "Registration may be limited to approved test accounts.",
  "Email verification is temporarily unavailable. Please try later.":
    "Verification messaging may be unavailable. Please try later.",
  // Previous redirect values are historical, not proof of delivery.
  "If this address has an account awaiting verification, a new link will arrive shortly.":
    RESEND_VERIFICATION_ADVISORY,
  [RESEND_VERIFICATION_ADVISORY]: RESEND_VERIFICATION_ADVISORY,
});

export function trustedCheckEmailNotice(raw: unknown): string | null {
  return typeof raw === "string" && raw.length <= 300 &&
    Object.hasOwn(allowed, raw) ? allowed[raw] : null;
}
