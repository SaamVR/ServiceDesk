import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { trustedWorkspaceRegistrationError } from "../../src/features/auth/workspace-registration-error";
import { validateWorkspaceFields } from "../../src/features/auth/registration";

describe("P02 trusted workspace setup error presentation", () => {
  it("preserves intended server-originated registration messages", () => {
    for (const message of [
      "Workspace creation is not approved for this account. Contact the administrator.",
      "This workspace address is taken. Try another.",
      "Verify your email before creating a workspace.",
      "Business name must be between 2 and 120 characters.",
      "Workspace address must be 3–40 lowercase letters, numbers or single hyphens.",
      "Select another business timezone.",
      "Choose a supported business currency.",
    ]) {
      expect(trustedWorkspaceRegistrationError(message)).toBe(message);
    }
  });
  it("does not render untrusted URL instructions as product errors", () => {
    for (const attackerText of [
      "Security alert: email your password to admin@attacker.example",
      "<img src=x onerror=alert(1)>",
      "Contact support at https://attacker.example",
      "Workspace creation is not approved for this account. Contact the administrator.\nPlease pay now.",
      "Registration succeeded, you may share your credentials.",
      "A".repeat(10000),
    ]) {
      const shown = trustedWorkspaceRegistrationError(attackerText);
      expect(shown).toBe("Workspace setup could not be completed. Please try again or contact the administrator.");
      expect(shown).not.toContain(attackerText);
    }
  });
  it("omits absent or invalid-shaped error values", () => {
    for (const value of [null, undefined, "", ["approved"], { message: "forged" }, 123]) {
      expect(trustedWorkspaceRegistrationError(value)).toBeNull();
    }
  });
  it("aligns browser slug validation with the authoritative server validator", () => {
    const page = readFileSync("src/app/auth/create-workspace/page.tsx", "utf8");
    const pattern = page.match(/name="slug" pattern="([^"]+)"/)?.[1];
    expect(pattern).toBeTruthy();
    expect(page).toContain('minLength={3} maxLength={40}');
    const browserPattern = new RegExp("^(?:" + pattern + ")$", "v");
    for (const slug of [
      "abc", "a-b", "a1-b2", "a".repeat(40),
      "ab", "a--b", "abc-", "-abc", "abc_", "a".repeat(41),
    ]) {
      const browserValid = slug.length >= 3 && slug.length <= 40 && browserPattern.test(slug);
      const serverValid = validateWorkspaceFields({
        name: "Example Cleaning", slug, timezone: "UTC", currency: "USD",
      }) === null;
      expect(browserValid, slug).toBe(serverValid);
    }
  });

  it("requires the actual workspace page to use the trusted presentation result", () => {
    const page = readFileSync("src/app/auth/create-workspace/page.tsx", "utf8");
    expect(page).toContain("trustedWorkspaceRegistrationError(query.error)");
    expect(page).toContain("{trustedError}");
    expect(page).not.toContain("{query.error}");
  });
});
