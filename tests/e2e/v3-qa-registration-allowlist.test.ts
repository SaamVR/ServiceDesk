import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ownerRegistrationAvailable, ownerRegistrationEmailAllowed, ownerRegistrationMode, ownerRegistrationPubliclyAvailable } from "@/features/auth/owner-registration-readiness";

const env: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture",
  SERVICEDESK_AUTH_REDIRECT_ORIGIN: "https://servicedesk-v3-frontend-review.onrender.com",
  SERVICEDESK_OWNER_REGISTRATION_ENABLED: "false",
  SERVICEDESK_OWNER_REGISTRATION_QA_ENABLED: "true",
  SERVICEDESK_OWNER_REGISTRATION_QA_EMAILS: "tester@example.com, second@example.org",
};
const file = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("V3 QA-only verified-email registration", () => {
  it("fails closed without explicit QA flag, allowlist or trusted auth setup", () => {
    expect(ownerRegistrationMode({ ...env, SERVICEDESK_OWNER_REGISTRATION_QA_ENABLED: undefined })).toBe("DISABLED");
    expect(ownerRegistrationMode({ ...env, SERVICEDESK_OWNER_REGISTRATION_QA_EMAILS: "" })).toBe("DISABLED");
    expect(ownerRegistrationMode({ ...env, NEXT_PUBLIC_SUPABASE_URL: undefined })).toBe("DISABLED");
    expect(ownerRegistrationMode({ ...env, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: undefined })).toBe("DISABLED");
    expect(ownerRegistrationMode({ ...env, SERVICEDESK_AUTH_REDIRECT_ORIGIN: "http://untrusted.example" })).toBe("DISABLED");
  });

  it("permits only exact normalized QA email addresses, never public marketing signup", () => {
    expect(ownerRegistrationMode(env)).toBe("QA_ONLY");
    expect(ownerRegistrationAvailable(env)).toBe(true);
    expect(ownerRegistrationPubliclyAvailable(env)).toBe(false);
    expect(ownerRegistrationEmailAllowed("TESTER@EXAMPLE.COM", env)).toBe(true);
    expect(ownerRegistrationEmailAllowed(" second@example.org ", env)).toBe(true);
    expect(ownerRegistrationEmailAllowed("attacker@example.com", env)).toBe(false);
    expect(ownerRegistrationEmailAllowed("tester@example.com.evil", env)).toBe(false);
    expect(ownerRegistrationEmailAllowed(null, env)).toBe(false);
  });

  it("rejects malformed, oversized and wildcard allowlists", () => {
    for (const value of ["*@example.com", "test@", "tester@example.com,".repeat(11), "tester@example.com,".repeat(300)]) {
      expect(ownerRegistrationMode({ ...env, SERVICEDESK_OWNER_REGISTRATION_QA_EMAILS: value })).toBe("DISABLED");
    }
  });

  it("public rollout requires a separate explicit flag", () => {
    const live = { ...env, SERVICEDESK_OWNER_REGISTRATION_ENABLED: "true" };
    expect(ownerRegistrationMode(live)).toBe("PUBLIC");
    expect(ownerRegistrationPubliclyAvailable(live)).toBe(true);
    expect(ownerRegistrationEmailAllowed("anyone@example.org", live)).toBe(true);
    expect(ownerRegistrationMode({ ...live, SERVICEDESK_AUTH_REDIRECT_ORIGIN: undefined, RENDER_EXTERNAL_URL: undefined })).toBe("DISABLED");
  });

  it("guards every server-side signup, resend, owner RPC action before touching external systems", () => {
    const signup = file("src/app/auth/sign-up/actions.ts");
    const resend = file("src/app/auth/sign-up/check-email/actions.ts");
    const owner = file("src/app/auth/create-workspace/actions.ts");
    for (const source of [signup, resend, owner]) expect(source).toContain("ownerRegistrationEmailAllowed(");
    expect(signup.indexOf("ownerRegistrationEmailAllowed(email)")).toBeLessThan(signup.indexOf("auth.auth.signUp"));
    expect(resend.indexOf("ownerRegistrationEmailAllowed(email)")).toBeLessThan(resend.indexOf("client.auth.resend"));
    expect(owner.indexOf("ownerRegistrationEmailAllowed(actor.user.email)")).toBeLessThan(owner.indexOf('auth.rpc("servicedesk_register_owner_workspace"'));
    expect(owner).toContain("email_confirmed_at");
  });

  it("keeps public marketing in tour mode while QA registration is available directly", () => {
    for (const path of ["src/components/shell/MarketingShell.tsx", "src/app/page.tsx", "src/app/auth/sign-in/page.tsx"]) {
      expect(file(path)).toContain("ownerRegistrationPubliclyAvailable()");
    }
    expect(file("src/app/auth/sign-up/page.tsx")).toContain("approved test email addresses");
  });
});
