import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { supabasePublicConfig } from "../../src/features/auth/supabase-public-config";
import { trustedAuthDestination } from "../../src/features/auth/email-origin";

const source = (file: string) => readFileSync(join(process.cwd(), file), "utf8");

describe("V3 server-side Supabase auth and onboarding", () => {
  const defaults: Readonly<Record<string, string | undefined>> = {
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_mock",
  };

  it("honors an active modern publishable key without requiring a legacy key", () => {
    expect(supabasePublicConfig(defaults)).toEqual({
      url: "https://example.supabase.co",
      publishableKey: "sb_publishable_mock",
    });
  });

  it("supports older anon-key deployments without requiring privileged secrets", () => {
    expect(supabasePublicConfig({
      SUPABASE_URL: "https://legacy.supabase.co",
      SUPABASE_ANON_KEY: "legacy-public-anon",
    })).toEqual({
      url: "https://legacy.supabase.co",
      publishableKey: "legacy-public-anon",
    });
  });

  it("does not permit unsafe or cross-origin-style config values", () => {
    expect(supabasePublicConfig({})).toBeNull();
    expect(supabasePublicConfig({ ...defaults, NEXT_PUBLIC_SUPABASE_URL: "http://example.supabase.co" })).toBeNull();
    expect(supabasePublicConfig({ ...defaults, NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co@evil.example" })).toBeNull();
    expect(supabasePublicConfig({ ...defaults, NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co/auth/v1" })).toBeNull();
    expect(supabasePublicConfig({ ...defaults, NEXT_PUBLIC_SUPABASE_URL: "https://evil.example" })).toBeNull();
  });

  it("redirects only to server-approved public Auth origins, never proxy localhost", () => {
    const env = {
      SERVICEDESK_AUTH_REDIRECT_ORIGIN: "https://servicedesk-v2-multilane-gate.onrender.com",
    };
    expect(trustedAuthDestination("/auth/sign-in?error=missing", env)?.href)
      .toBe("https://servicedesk-v2-multilane-gate.onrender.com/auth/sign-in?error=missing");
    expect(trustedAuthDestination("/auth/continue", env)?.origin)
      .toBe("https://servicedesk-v2-multilane-gate.onrender.com");
    expect(trustedAuthDestination("//evil.example/auth/continue", env)).toBeNull();
    expect(trustedAuthDestination("https://evil.example", env)).toBeNull();
    expect(trustedAuthDestination("/auth/continue", {})).toBeNull();

    const continueRoute = source("src/app/auth/continue/route.ts");
    const confirmRoute = source("src/app/auth/confirm/route.ts");
    expect(continueRoute).toContain("trustedAuthDestination(path)");
    expect(confirmRoute).toContain("trustedAuthDestination(");
    expect(continueRoute).not.toContain("request.url");
    expect(confirmRoute).not.toContain("request.url");
  });

  it("keeps service-only operational authority while accepting the modern public key", () => {
    const operational = source("src/features/operations/operational-product-runtime.ts");
    expect(operational).toContain("supabasePublicConfig()");
    expect(operational).toContain("process.env.SUPABASE_SERVICE_ROLE_KEY");
    expect(operational).toContain("if (!publicConfig || !serviceRoleKey) return undefined");
    expect(operational).toContain("auth.auth.getUser()");
    expect(operational).toContain('.from("memberships")');
  });

  it("reads owner workspace identity through RLS rather than a privileged client", () => {
    const onboarding = source("src/features/onboarding/onboarding-product-runtime.ts");
    const baseSchema = source("supabase/migrations/0001_core.sql");
    expect(onboarding).toContain("supabasePublicConfig()");
    expect(onboarding).toContain("auth.auth.getUser()");
    expect(onboarding).toMatch(/auth\s*\.from\("memberships"\)/);
    expect(onboarding).toMatch(/auth\s*\.from\("workspaces"\)/);
    expect(onboarding).not.toContain("createClient(");
    expect(onboarding).not.toContain("process.env.SUPABASE_SERVICE_ROLE_KEY");
    expect(baseSchema).toContain("create policy memberships_self_or_owner_select on public.memberships");
    expect(baseSchema).toContain("create policy workspaces_staff_select on public.workspaces");
  });
});
