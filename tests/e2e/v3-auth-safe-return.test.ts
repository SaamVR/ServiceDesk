import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeReturnPath } from "@/features/auth/return-path";

describe("auth return-to-workspace behavior", () => {
  it("defaults to authorized workspace continuation, never customer-only portal", () => {
    for (const value of [undefined, "", " ", "http://bad.test", "//evil.example", "/\\evil.example", "\n/evil.example"]) {
      expect(normalizeReturnPath(value)).toBe("/auth/continue");
    }
  });

  it("preserves explicitly requested authorized destinations and their query parameters", () => {
    expect(normalizeReturnPath("/auth/continue")).toBe("/auth/continue");
    expect(normalizeReturnPath("/app/brightroom/overview")).toBe("/app/brightroom/overview");
    expect(normalizeReturnPath("/onboarding?workspace=brightroom")).toBe("/onboarding?workspace=brightroom");
    expect(normalizeReturnPath("/portal")).toBe("/portal");
    expect(normalizeReturnPath("/crew/today")).toBe("/crew/today");
  });

  it("prevents password, confirmation or sign-in control-flow loops and CRLF backslash injection", () => {
    for (const value of [
      "/auth/sign-in", "/auth/sign-in?next=/auth/sign-in",
      "/auth/sign-out", "/auth/confirm?token_hash=x",
      "/auth/reset-password", "/auth/confirm",
      "/app/owner\nLocation: //evil.example",
      "/app\\secret", "/app%5csecret", "/app%0dfoo", "/app%0Afoo",
    ]) expect(normalizeReturnPath(value)).toBe("/auth/continue");
  });

  it("keeps the application sign-in route and action using the shared normalizer", () => {
    const src = (name: string) => readFileSync(join(process.cwd(), name), "utf8");
    const login = src("src/app/auth/sign-in/page.tsx");
    const action = src("src/app/auth/sign-in/actions.ts");
    expect(login).toContain('normalizeReturnPath(query.next ?? "/auth/continue")');
    expect(action).toContain('normalizeReturnPath(String(formData.get("next")');
    expect(action).toContain("redirect(next)");
  });

  it("offers approved QA signup from the login page while hiding it from public marketing", () => {
    const src = (name: string) => readFileSync(join(process.cwd(), name), "utf8");
    const login = src("src/app/auth/sign-in/page.tsx");
    expect(login).toContain('ownerRegistrationMode() === "QA_ONLY"');
    expect(login).toContain('href="/auth/sign-up"');
    expect(login).toContain("invited email address");
    expect(login).toContain("marketingRegistrationEntry(registrationAvailable)");
    const home = src("src/app/page.tsx");
    expect(home).toContain("ownerRegistrationPubliclyAvailable()");
  });
});
