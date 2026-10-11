import { describe, expect, it } from "vitest";
import "./v3-signin-registration-truth.test";
import "./v4-clean-air-home.test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { marketingHeroEntry, marketingRegistrationEntry } from "@/features/auth/marketing-entry-policy";
import { ownerRegistrationAvailable } from "@/features/auth/owner-registration-readiness";
const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
describe("Marketing CTA and closed-registration release truth", () => {
  it("offers a real public tour rather than unusable signup when registration is blocked", () => {
    expect(marketingRegistrationEntry(false)).toEqual({
      href: "/tour", desktop: "Explore tour", mobile: "Take tour",
    });
    expect(marketingHeroEntry(false, "/auth/sign-up", "Create your workspace")).toEqual({
      href: "/tour", label: "Explore product tour",
    });
    expect(marketingHeroEntry(false, "/features", "Features").href).toBe("/features");
  });
  it("restores the account action only when the actual registration gate is available", () => {
    expect(marketingRegistrationEntry(true).href).toBe("/auth/sign-up");
    expect(marketingHeroEntry(true, "/auth/sign-up", "Create workspace").href).toBe("/auth/sign-up");
    expect(ownerRegistrationAvailable({} as NodeJS.ProcessEnv)).toBe(false);
    expect(ownerRegistrationAvailable({
      ...process.env,
      SERVICEDESK_OWNER_REGISTRATION_ENABLED: "true",
    })).toBe(false);
  });
  it("applies policy to navigation and home hero while leaving sign-in working", () => {
    const nav = source("src/components/shell/MarketingShell.tsx");
    const home = source("src/app/page.tsx");
    expect(nav).toContain("registration = marketingRegistrationEntry(registrationEnabled)");
    expect(nav).toContain("heroAction = marketingHeroEntry(registrationEnabled");
    expect(nav).toContain("href={registration.href}");
    expect(nav).toContain("href={heroAction.href}");
    expect(nav).not.toContain('href="/auth/sign-up"');
    expect(nav).toContain('href="/auth/sign-in"');
    expect(home).toContain('secondaryHref={canRegister ? "/tour" : "/features"}');
    expect(home).toContain('primaryHref={canRegister ? "/auth/sign-up" : "/tour"}');
  });
});
