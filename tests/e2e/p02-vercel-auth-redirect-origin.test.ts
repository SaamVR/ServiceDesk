import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  trustedAuthDestination,
  verifiedEmailRedirectOrigin,
} from "../../src/features/auth/email-origin";

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
    expect(verifiedEmailRedirectOrigin(undefined, previousRender, undefined)).toBe(previousRender);
    expect(verifiedEmailRedirectOrigin(undefined, previousRender, "0")).toBe(previousRender);
    expect(verifiedEmailRedirectOrigin(approved, previousRender, undefined)).toBe(approved);
  });

  it("never silently reuses an old host after malformed explicit operator configuration", () => {
    expect(verifiedEmailRedirectOrigin("https://bad.example/evil", previousRender, "1")).toBeNull();
    expect(verifiedEmailRedirectOrigin("https://bad.example/evil", previousRender, undefined)).toBeNull();
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

  it("both signup and password recovery reuse the same validated origin helper", () => {
    const files=["src/app/auth/sign-up/actions.ts",
      "src/app/auth/forgot-password/actions.ts",
      "src/features/auth/owner-registration-readiness.ts"];
    for (const file of files) {
      const src=readFileSync(file,"utf8");
      expect(src).toContain("verifiedEmailRedirectOrigin(");
      expect(src).toContain("process.env.RENDER_EXTERNAL_URL");
    }
    const origin=readFileSync("src/features/auth/email-origin.ts","utf8");
    expect(origin).toContain('vercelRuntime === "1"');
    expect(origin).toContain("env.VERCEL");
    expect(origin).not.toContain("req.headers.host");
  });
});
