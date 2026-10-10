import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { RegistrationShell } from "../../src/features/auth/RegistrationShell";
import { verifiedEmailRedirectOrigin } from "../../src/features/auth/email-origin";
import { ownerRegistrationAvailable } from "../../src/features/auth/owner-registration-readiness";
import {
  businessSlug, normalizedEmail, validateRegistrationFields, validateWorkspaceFields,
} from "../../src/features/auth/registration";

vi.mock("next/link", () => ({ default: "a" }));
const file = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("V3 customer-safe account creation and onboarding", () => {
  it("normalizes email and rejects weak credentials before hitting provider", () => {
    expect(normalizedEmail("  OWNER@Example.COM  ")).toBe("owner@example.com");
    expect(validateRegistrationFields({ email: "bad", password: "012345678901" })).toMatch(/email/i);
    expect(validateRegistrationFields({ email: "valid@example.com", password: "short" })).toMatch(/password/i);
    expect(validateRegistrationFields({ email: "valid@example.com", password: "A-secret-password-of-sufficient-length" })).toBeNull();
  });

  it("generates safe business addresses and rejects invalid workspace settings", () => {
    expect(businessSlug(" Bright Home & Office Cleaning ")).toBe("bright-home-office-cleaning");
    expect(businessSlug("Áçmé Clean!")).toBe("acme-clean");
    const valid = {name: "Bright Home Cleaning",slug:"bright-home",timezone:"Europe/London",currency:"GBP"};
    expect(validateWorkspaceFields(valid)).toBeNull();
    expect(validateWorkspaceFields({...valid,slug:"../admin"})).toMatch(/address/i);
    expect(validateWorkspaceFields({...valid,slug:"wrong--slug"})).toMatch(/address/i);
    expect(validateWorkspaceFields({...valid,timezone:"Unknown/Zone"})).toMatch(/timezone/i);
    expect(validateWorkspaceFields({...valid,currency:"FAKE"})).toMatch(/currency/i);
  });

  it("renders a real accessible marketing-facing registration shell", () => {
    const html = renderToStaticMarkup(createElement(RegistrationShell, {
      eyebrow: "Step 1 of 2", title: "Create your account",
      description: "Join your team", asideTitle: "Your operations, one place",
      asideItems: ["Manage enquiries", "Schedule your crews", "Collect invoices"],
    }, createElement("form", { "aria-label": "Registration" })));
    expect(html).toContain('id="registration-heading"');
    expect(html).toContain('aria-labelledby="registration-heading"');
    expect(html).toContain("Create your account");
    expect(html).toContain("Manage enquiries");
    expect(html).toContain('href="/privacy"');
    expect(html).toContain('href="/terms"');
  });

  it("requires authenticated verified identity for atomic workspace ownership", () => {
    const sql = file("supabase/migrations/0059_v3_verified_owner_workspace_bootstrap.sql");
    expect(sql).toContain("v_actor uuid := (select auth.uid())");
    expect(sql).toContain("email_confirmed_at is not null");
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = pg_catalog, public, pg_temp");
    expect(sql).toContain("insert into public.workspaces");
    expect(sql).toContain("insert into public.memberships");
    expect(sql).toContain("'OWNER', 'ACTIVE'");
    expect(sql).toContain("insert into public.workspace_branches");
    expect(sql).toContain("insert into public.branch_memberships");
    expect(sql).toContain("insert into public.audit_events");
    expect(sql).toContain("revoke all on function public.servicedesk_register_owner_workspace");
    expect(sql).toContain("to authenticated;");
    expect(sql).not.toMatch(/grant execute[^;]+to anon;/i);
  });

  it("keeps the responsive marketing navigation reachable without crushing the brand", () => {
    const shell = file("src/components/shell/MarketingShell.tsx");
    const css = file("src/components/shell/MarketingNavV3.module.css");
    expect(shell).toContain("styles.mobileMenu");
    expect(shell).toContain('aria-label="Open product menu"');
    expect(shell).toContain('aria-label="Mobile product navigation"');
    expect(shell).toContain('href="/auth/sign-up"');
    expect(shell).toContain('href="/auth/sign-in"');
    expect(css).toContain("width: auto !important");
    expect(css).toContain("min-width: max-content");
    expect(css).toContain(".desktopNav { display: none !important; }");
    expect(css).toContain("min-height: 44px");
  });

  it("refuses owner signup until the explicit deploy switch, keys and trusted email origin agree", () => {
    const ready = {
      SERVICEDESK_OWNER_REGISTRATION_ENABLED: "true",
      NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public-placeholder",
      SERVICEDESK_AUTH_REDIRECT_ORIGIN: "https://servicedesk-preview.onrender.com",
    } as NodeJS.ProcessEnv;
    expect(ownerRegistrationAvailable(ready)).toBe(true);
    expect(ownerRegistrationAvailable({ ...ready, SERVICEDESK_OWNER_REGISTRATION_ENABLED: "false" })).toBe(false);
    expect(ownerRegistrationAvailable({ ...ready, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: undefined })).toBe(false);
    expect(ownerRegistrationAvailable({ ...ready, SERVICEDESK_AUTH_REDIRECT_ORIGIN: "http://wrong.example" })).toBe(false);
    expect(ownerRegistrationAvailable({})).toBe(false);
    const signup = file("src/app/auth/sign-up/actions.ts");
    const workspace = file("src/app/auth/create-workspace/actions.ts");
    const page = file("src/app/auth/sign-up/page.tsx");
    expect(signup).toContain("if (!ownerRegistrationAvailable())");
    expect(workspace).toContain("if (!ownerRegistrationAvailable())");
    expect(page).toContain("disabled={!registrationEnabled}");
  });

  it("accepts only server-owned HTTPS auth redirect origins, rejecting injection or unsafe hosts", () => {
    expect(verifiedEmailRedirectOrigin("https://test.example.com", undefined)).toBe("https://test.example.com");
    expect(verifiedEmailRedirectOrigin(undefined, "https://servicedesk-preview.onrender.com"))
      .toBe("https://servicedesk-preview.onrender.com");
    expect(verifiedEmailRedirectOrigin("http://test.example.com", undefined)).toBeNull();
    expect(verifiedEmailRedirectOrigin("https://evil.example/path", undefined)).toBeNull();
    expect(verifiedEmailRedirectOrigin("https://evil.example?next=/admin", undefined)).toBeNull();
    expect(verifiedEmailRedirectOrigin("https://user:pass@evil.example", undefined)).toBeNull();
    expect(verifiedEmailRedirectOrigin("//evil.example", undefined)).toBeNull();
    expect(verifiedEmailRedirectOrigin(undefined, undefined)).toBeNull();
  });

  it("does not disclose account existence in password recovery or allow a caller-provided callback destination", () => {
    const action = file("src/app/auth/forgot-password/actions.ts");
    const update = file("src/app/auth/reset-password/actions.ts");
    const callback = file("src/app/auth/confirm/route.ts");
    const signIn = file("src/app/auth/sign-in/page.tsx");
    expect(action).toContain("resetPasswordForEmail");
    expect(action).toContain('"/auth/confirm?flow=recovery"');
    expect(action).toContain('"/auth/forgot-password/check-email"');
    expect(action).not.toContain("error.message");
    expect(update).toContain("auth.auth.getUser()");
    expect(update).toContain("email_confirmed_at");
    expect(update).toContain("auth.auth.updateUser({ password })");
    expect(update).toContain("auth.auth.signOut()");
    expect(callback).toContain('flow === "recovery"');
    expect(callback).toContain('"recovery" : "email"');
    expect(signIn).toContain('href="/auth/forgot-password"');
  });

  it("prevents open redirects from registration and recovery email origins", () => {
    const signup = file("src/app/auth/sign-up/actions.ts");
    const forgot = file("src/app/auth/forgot-password/actions.ts");
    const origin = file("src/features/auth/email-origin.ts");
    expect(signup).toContain("verifiedEmailRedirectOrigin(");
    expect(forgot).toContain("verifiedEmailRedirectOrigin(");
    expect(origin).not.toContain("request.headers.get");
    expect(origin).not.toContain("searchParams.get");
    expect(origin).toContain('url.protocol !== "https:"');
  });

  it("routes confirmation only to fixed same-origin continuation and records no supplied role", () => {
    const callback = file("src/app/auth/confirm/route.ts");
    const signup = file("src/app/auth/sign-up/actions.ts");
    const workspace = file("src/app/auth/create-workspace/actions.ts");
    const next = file("src/app/auth/continue/route.ts");
    expect(callback).toContain('"/auth/continue"');
    expect(callback).toContain("exchangeCodeForSession");
    expect(callback).toContain("verifyOtp");
    expect(callback).toContain("email_confirmed_at");
    expect(signup).toContain("emailRedirectTo");
    expect(signup).toContain('"/auth/confirm"');
    expect(signup).not.toContain("formData.get(\"role\")");
    expect(workspace).toContain('auth.rpc("servicedesk_register_owner_workspace"');
    expect(workspace).toContain("email_confirmed_at");
    expect(next).toContain('"/auth/create-workspace"');
    expect(next).toContain('"/crew/today"');
  });
});
