import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  trustedAuthDestination,
  verifiedEmailRedirectOrigin,
} from "../../src/features/auth/email-origin";
import {
  ownerRegistrationMode,
  ownerRegistrationEmailAllowed,
} from "../../src/features/auth/owner-registration-readiness";

const previousRender = "https://legacy-servicedesk.onrender.com";
const approved = "https://approved-servicedesk.vercel.app";

describe("P02 Vercel auth-origin migration guard", () => {
  it("rejects an old Render fallback under Vercel even when it is HTTPS", () => {
    expect(verifiedEmailRedirectOrigin(undefined, previousRender, "1")).toBeNull();
    expect(verifiedEmailRedirectOrigin("  ", previousRender, "1")).toBeNull();
    expect(verifiedEmailRedirectOrigin(undefined, previousRender, "1")).not.toBe(previousRender);
  });

  it("requires a separately configured explicit HTTPS origin on Vercel", () => {
    expect(verifiedEmailRedirectOrigin(approved, previousRender, "1")).toBe(approved);
    expect(verifiedEmailRedirectOrigin(" "+approved+"/ ", previousRender, "1")).toBe(approved);
    expect(verifiedEmailRedirectOrigin("http://approved-servicedesk.vercel.app", previousRender, "1")).toBeNull();
    expect(verifiedEmailRedirectOrigin("https://user:pass@approved-servicedesk.vercel.app", previousRender, "1")).toBeNull();
  });

  it("preserves historical Render fallback outside Vercel without changing old host operation", () => {
    expect(verifiedEmailRedirectOrigin(undefined, previousRender, "0")).toBe(previousRender);
    expect(verifiedEmailRedirectOrigin("  ", previousRender, "0")).toBe(previousRender);
    expect(verifiedEmailRedirectOrigin(approved, previousRender, "0")).toBe(approved);
  });

  it("never silently reuses an old host after malformed explicit operator configuration", () => {
    expect(verifiedEmailRedirectOrigin("https://bad.example/evil", previousRender, "1")).toBeNull();
    expect(verifiedEmailRedirectOrigin("https://bad.example/evil", previousRender, "0")).toBeNull();
    expect(verifiedEmailRedirectOrigin("https://bad.example#x", previousRender, "1")).toBeNull();
  });

  it("trusted destinations use passed Vercel runtime state and never fall back to stale Render", () => {
    expect(trustedAuthDestination("/auth/confirm", {
      VERCEL:"1", RENDER_EXTERNAL_URL:previousRender,
    })).toBeNull();
    expect(trustedAuthDestination("/auth/confirm?flow=recovery", {
      VERCEL:"1", RENDER_EXTERNAL_URL:previousRender,
      SERVICEDESK_AUTH_REDIRECT_ORIGIN:approved,
    })?.href).toBe(approved+"/auth/confirm?flow=recovery");
  });

  it("rejects protocol-relative / backslash host confusion for verification links", () => {
    const env={VERCEL:"1",SERVICEDESK_AUTH_REDIRECT_ORIGIN:approved};
    expect(trustedAuthDestination("//attacker.example/confirm",env)).toBeNull();
    expect(trustedAuthDestination("/\\attacker.example/confirm",env)).toBeNull();
    expect(trustedAuthDestination("https://attacker.example",env)).toBeNull();
  });

  it("signup readiness must use its injected Vercel runtime, not process-wide fallback", () => {
    const base = {
      NEXT_PUBLIC_SUPABASE_URL:"https://fictional-project.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"sb_publishable_synthetic_only",
      SERVICEDESK_OWNER_REGISTRATION_TENANT_AUTHZ_APPROVED:"true",
      SERVICEDESK_OWNER_REGISTRATION_QA_ENABLED:"true",
      SERVICEDESK_OWNER_REGISTRATION_QA_EMAILS:"owner-qa@example.test",
      RENDER_EXTERNAL_URL:previousRender,
    };
    const onVercel = { ...base, VERCEL:"1" };
    // An old Render host must not mark a new Vercel owner journey ready.
    expect(ownerRegistrationMode(onVercel)).toBe("DISABLED");
    expect(ownerRegistrationEmailAllowed("owner-qa@example.test",onVercel)).toBe(false);
    expect(ownerRegistrationMode({ ...onVercel,
      SERVICEDESK_OWNER_REGISTRATION_ENABLED:"true",
    })).toBe("DISABLED");
    const approvedVercel = { ...onVercel, SERVICEDESK_AUTH_REDIRECT_ORIGIN:approved };
    expect(ownerRegistrationMode(approvedVercel)).toBe("QA_ONLY");
    expect(ownerRegistrationEmailAllowed("owner-qa@example.test",approvedVercel)).toBe(true);
    expect(ownerRegistrationMode({ ...base, VERCEL:"0" })).toBe("QA_ONLY");
  });

  it("rejects a bad explicit origin on Vercel even with a legacy Render fallback", () => {
    const env = {
      NEXT_PUBLIC_SUPABASE_URL:"https://fictional-project.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"sb_publishable_synthetic_only",
      SERVICEDESK_OWNER_REGISTRATION_TENANT_AUTHZ_APPROVED:"true",
      SERVICEDESK_OWNER_REGISTRATION_QA_ENABLED:"true",
      SERVICEDESK_OWNER_REGISTRATION_QA_EMAILS:"owner-qa@example.test",
      VERCEL:"1",
      RENDER_EXTERNAL_URL:previousRender,
      SERVICEDESK_AUTH_REDIRECT_ORIGIN:"http://unsafe.example.test",
    };
    expect(ownerRegistrationMode(env)).toBe("DISABLED");
  });

  it("both signup and password recovery reuse the same validated origin helper", () => {
    const files=["src/app/auth/sign-up/actions.ts",
      "src/app/auth/forgot-password/actions.ts",
      "src/features/auth/owner-registration-readiness.ts"];
    for (const file of files) {
      const src=readFileSync(file,"utf8");
      expect(src).toContain("verifiedEmailRedirectOrigin(");
      expect(src).toContain("RENDER_EXTERNAL_URL");
    }
    const origin=readFileSync("src/features/auth/email-origin.ts","utf8");
    expect(origin).toContain('vercelRuntime === "1"');
    expect(origin).toContain("env.VERCEL");
    expect(origin).not.toContain("req.headers.host");
    const readiness=readFileSync("src/features/auth/owner-registration-readiness.ts","utf8");
    expect(readiness).toContain("env.VERCEL");

  });
});
