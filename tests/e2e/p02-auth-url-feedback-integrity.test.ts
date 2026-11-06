import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { trustedAuthFeedback } from "../../src/features/auth/verified-auth-feedback";

type AuthPage = "sign-in" | "sign-up" | "forgot-password" | "reset-password";
const pageSources: Record<AuthPage, string> = {
  "sign-in": "src/app/auth/sign-in/page.tsx",
  "sign-up": "src/app/auth/sign-up/page.tsx",
  "forgot-password": "src/app/auth/forgot-password/page.tsx",
  "reset-password": "src/app/auth/reset-password/page.tsx",
};
const known: Record<AuthPage, string[]> = {
  "sign-in": [
    "Enter your email address and password.",
    "Sign in is temporarily unavailable.",
    "The email or password is incorrect.",
    "The verification link has expired or could not be confirmed. Please try signing in.",
    "Sign-in is unavailable",
    "Workspace lookup unavailable",
    "Account lookup unavailable",
  ],
  "sign-up": [
    "Account creation is not enabled on this environment yet.",
    "Account creation on this preview is currently limited to approved test accounts.",
    "Account creation is not configured on this environment yet.",
    "Enter a valid email address.",
    "Use a password between 12 and 128 characters.",
    "Review and accept the Terms and Privacy Policy.",
    "Please wait before requesting another confirmation email.",
    "We could not start account registration. Try again shortly.",
  ],
  "forgot-password": [
    "Enter a valid email address.",
    "Password recovery is unavailable in this environment.",
    "Your reset link is invalid or expired. Request another link.",
  ],
  "reset-password": [
    "Choose a new password between 12 and 128 characters.",
    "The two passwords do not match.",
    "Password recovery is unavailable in this environment.",
    "Password could not be updated. Please request a fresh recovery link.",
  ],
};
const rawFile = (p: string) => readFileSync(p, "utf8");

describe("P02 authenticated account routes do not trust URL feedback", () => {
  it("retains every reviewed first-party error on its exact originating page", () => {
    for (const page of Object.keys(known) as AuthPage[]) {
      for (const message of known[page]) {
        expect(trustedAuthFeedback(page, "error", message)).toBe(message);
      }
    }
  });

  it("rejects attacker-controlled instructions, phish links and cross-page receipts", () => {
    for (const page of Object.keys(known) as AuthPage[]) {
      for (const message of [
        "Security alert: email your password to admin@attacker.example",
        "Send your recovery code to https://attacker.example/confirm",
        "<img src=x onerror=alert(1)>",
        "Password updated. Sign in with your new password.",
        "A".repeat(6000),
      ]) {
        const feedback = trustedAuthFeedback(page, "error", message);
        expect(feedback).toBe("We could not verify this error message. Please retry from this page.");
        expect(feedback).not.toContain("attacker.example");
        expect(feedback).not.toContain(message);
      }
    }
    expect(trustedAuthFeedback("forgot-password", "error",
      "The email or password is incorrect.")).not.toBe("The email or password is incorrect.");
  });

  it("does not treat arbitrary query shapes as trusted feedback", () => {
    for (const page of Object.keys(known) as AuthPage[]) {
      for (const input of [null, undefined, "", 42, ["The email or password is incorrect."],
        { error: "Enter a valid email address." }]) {
        expect(trustedAuthFeedback(page, "error", input)).toBeNull();
        expect(trustedAuthFeedback(page, "notice", input)).toBeNull();
      }
    }
  });

  it("does not certify sign-out or password change from a spoofable query notice", () => {
    for (const [raw, expected] of [
      ["You have been signed out.",
        "If you recently signed out, you can sign in again to continue."],
      ["Password updated. Sign in with your new password.",
        "If you changed your password, sign in using the new password."],
      ["Verify your email and sign in to create a workspace.",
        "Verify your email before signing in to create a workspace."],
    ]) {
      expect(trustedAuthFeedback("sign-in", "notice", raw)).toBe(expected);
      expect(trustedAuthFeedback("sign-in", "notice", raw)).not.toBe(raw);
    }
    expect(trustedAuthFeedback("sign-in", "notice",
      "Your account was locked. Pay $300 now.")).toBeNull();
    expect(trustedAuthFeedback("sign-in", "notice",
      "A".repeat(5000))).toBeNull();
    expect(trustedAuthFeedback("sign-up", "notice", "You have been signed out.")).toBeNull();
  });

  it("wires the real four server-rendered pages to the bounded helper", () => {
    for (const [page, filename] of Object.entries(pageSources) as [AuthPage, string][]) {
      const source = rawFile(filename);
      expect(source).toContain("trustedAuthFeedback(");
      expect(source).toContain(`trustedAuthFeedback("${page}", "error", query.error)`);
      expect(source).not.toContain("{query.error}");
      expect(source).not.toContain("dangerouslySetInnerHTML");
      if (page === "sign-in") {
        expect(source).toContain('trustedAuthFeedback("sign-in", "notice", query.notice)');
        expect(source).not.toContain("{query.notice}");
      }
    }
  });

  it("retains the already approved source-only deployment and owner-readback gates", () => {
    const vercel = JSON.parse(rawFile("vercel.json"));
    expect(vercel.git).toEqual({ deploymentEnabled: false });
    const creation = rawFile("src/app/auth/create-workspace/actions.ts");
    expect(creation).toContain("verifyOwnerWorkspaceCreationReadback(");
    expect(creation).toContain('"REGISTRATION_NOT_AUTHORIZED"');
    expect(creation).not.toContain("auth.admin");
    const signup = rawFile("src/app/auth/sign-up/actions.ts");
    expect(signup).toContain("ownerRegistrationAvailable()");
    expect(signup).toContain("ownerRegistrationEmailAllowed(email)");
  });
});
