import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("V3 email confirmation templates for SSR accounts", () => {
  const signup = read("supabase/auth-templates/confirm-signup.html");
  const recovery = read("supabase/auth-templates/recovery.html");
  const confirmRoute = read("src/app/auth/confirm/route.ts");

  it("sends email verification through the configured public site and SSR token-hash flow", () => {
    expect(signup).toContain("{{ .RedirectTo }}?token_hash={{ .TokenHash }}&amp;type=email");
    expect(confirmRoute).toContain('const tokenHash = request.nextUrl.searchParams.get("token_hash")');
    expect(confirmRoute).toContain('type: flow === "recovery" ? "recovery" : "email"');
    expect(confirmRoute).toContain("auth.verifyOtp(");
    expect(confirmRoute).toContain('"/auth/continue"');
  });

  it("keeps password reset isolated from signup and sends it to the recovery session", () => {
    expect(recovery).toContain("{{ .RedirectTo }}&amp;token_hash={{ .TokenHash }}");
    expect(confirmRoute).toContain('request.nextUrl.searchParams.get("flow") === "recovery"');
    expect(confirmRoute).toContain('"/auth/reset-password"');
    expect(recovery).not.toContain("type=email");
    expect(recovery).not.toContain("{{ .SiteURL }}");
    expect(signup).not.toContain("flow=recovery");
  });

  it("pins the owner-approved temporary Resend sender to the staging checklist", () => {
    const runbook = read("docs/execution/v3-resend-supabase-auth-staging-20261011.md");
    expect(runbook).toContain("no-reply@ezcomo.shop");
    expect(runbook).toContain("smtp.resend.com");
    expect(runbook).toContain("ServiceDesk AI");
    expect(runbook).toContain("SIGNUP_DISABLED");
    expect(runbook).toContain("SMTP_NOT_WIRED");
    expect(runbook).not.toContain("re_live_");
  });

  it("never embeds secrets, a fake customer identity, URL shorteners or tracking pixels", () => {
    for (const html of [signup, recovery]) {
      expect(html).not.toContain("{{ .ConfirmationURL }}");
      expect(html).not.toMatch(/<script\b|onclick=|tracking-pixel|<img\b/i);
      expect(html).not.toMatch(/service_role|re_[A-Za-z0-9]{20,}/i);
      expect(html).not.toContain("http://");
      expect(html).toContain('<html lang="en">');
      expect(html).toContain("ignore this");
    }
  });
});
