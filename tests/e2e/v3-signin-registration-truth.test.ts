import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { marketingRegistrationEntry } from "@/features/auth/marketing-entry-policy";
import { ownerRegistrationAvailable } from "@/features/auth/owner-registration-readiness";

const read = (name: string) => readFileSync(join(process.cwd(), name), "utf8");

describe("V3 signed-out first-use registration truth", () => {
  it("offers product tour when owner registration is disabled without affecting existing sign-in", () => {
    expect(marketingRegistrationEntry(false)).toEqual({
      href: "/tour", desktop: "Explore tour", mobile: "Take tour",
    });
    expect(ownerRegistrationAvailable({})).toBe(false);
    const source = read("src/app/auth/sign-in/page.tsx");
    expect(source).toContain("const registrationAvailable = ownerRegistrationAvailable()");
    expect(source).toContain("const newVisitorEntry = marketingRegistrationEntry(registrationAvailable)");
    expect(source).toContain("href={newVisitorEntry.href}");
    expect(source).toContain('registrationAvailable ? "Create your account" : "Explore the product tour"');
    expect(source).not.toContain('<Link href="/auth/sign-up"><strong>Create your account</strong></Link>');
    expect(source).toContain('action={signInWithPassword}');
    expect(source).toContain('href="/auth/forgot-password"');
  });

  it("restores account creation only through existing server-controlled readiness checks", () => {
    expect(marketingRegistrationEntry(true)).toEqual({
      href: "/auth/sign-up", desktop: "Create account", mobile: "Get started",
    });
    const ready = {
      SERVICEDESK_OWNER_REGISTRATION_ENABLED: "true",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "nonsecret-public-placeholder",
      SERVICEDESK_AUTH_REDIRECT_ORIGIN: "https://review.example.test",
    } as NodeJS.ProcessEnv;
    expect(ownerRegistrationAvailable(ready)).toBe(true);
    expect(ownerRegistrationAvailable({
      ...ready,
      SERVICEDESK_OWNER_REGISTRATION_ENABLED: "false",
    })).toBe(false);
    const signup = read("src/app/auth/sign-up/actions.ts");
    expect(signup).toContain("if (!ownerRegistrationAvailable())");
  });

  it("keeps the signin page server-owned and free from client-provided switch or role", () => {
    const source = read("src/app/auth/sign-in/page.tsx");
    expect(source).not.toContain('"use client"');
    expect(source).not.toContain("searchParams.get(\"register\")");
    expect(source).not.toContain("NEXT_PUBLIC_OWNER_REGISTRATION_ENABLED");
    expect(source).not.toContain('formData.get("role")');
    expect(source).not.toContain("service_role");
  });
});
