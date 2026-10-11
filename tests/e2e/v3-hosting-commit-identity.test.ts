import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { verifiedHostingCommitIdentity } from "@/app/health/deployment-identity";
import { GET } from "@/app/health/route";

const sha = "e".repeat(40);
const other = "f".repeat(40);

describe("V3 staging commit identity", () => {
  it("accepts only a valid hosting provider full SHA", () => {
    expect(verifiedHostingCommitIdentity({ RENDER_GIT_COMMIT: sha })).toEqual({
      sourceSha: sha, sourceProvider: "render",
    });
    expect(verifiedHostingCommitIdentity({ VERCEL_GIT_COMMIT_SHA: sha.toUpperCase() })).toEqual({
      sourceSha: sha, sourceProvider: "vercel",
    });
    expect(verifiedHostingCommitIdentity({
      RENDER_GIT_COMMIT: sha, VERCEL_GIT_COMMIT_SHA: sha.toUpperCase(),
    })).toEqual({ sourceSha: sha, sourceProvider: "both" });
  });

  it("fails closed for absent, malformed or disagreeing host claims", () => {
    expect(verifiedHostingCommitIdentity({})).toBeUndefined();
    expect(verifiedHostingCommitIdentity({ RENDER_GIT_COMMIT: "candidate" })).toBeUndefined();
    expect(verifiedHostingCommitIdentity({ RENDER_GIT_COMMIT: "" })).toBeUndefined();
    expect(verifiedHostingCommitIdentity({
      RENDER_GIT_COMMIT: sha, VERCEL_GIT_COMMIT_SHA: other,
    })).toBeUndefined();
    expect(verifiedHostingCommitIdentity({
      RENDER_GIT_COMMIT: sha, VERCEL_GIT_COMMIT_SHA: "invalid",
    })).toBeUndefined();
  });

  it("only exposes non-secret identity with no-store and no content sniffing", async () => {
    vi.stubEnv("RENDER_GIT_COMMIT", sha);
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "");
    try {
      // A malformed second host claim must never produce a misleading SHA.
      let r = GET();
      expect(r.status).toBe(200);
      expect(r.headers.get("Cache-Control")).toBe("no-store");
      expect(r.headers.get("X-Content-Type-Options")).toBe("nosniff");
      expect(await r.json()).toEqual({ ok: true, service: "servicedesk", status: "live" });
      vi.stubEnv("VERCEL_GIT_COMMIT_SHA", sha);
      r = GET();
      expect(await r.json()).toEqual({
        ok: true, service: "servicedesk", status: "live",
        sourceSha: sha, sourceProvider: "both",
      });
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("keeps release identity independent of untrusted request URLs and operator-supplied strings", () => {
    const route = readFileSync(join(process.cwd(), "src/app/health/route.ts"), "utf8");
    const script = readFileSync(join(process.cwd(), "scripts/release/v3-staging-source-preflight.mjs"), "utf8");
    expect(route).toContain("verifiedHostingCommitIdentity(process.env)");
    expect(route).not.toContain("searchParams");
    expect(script).toContain('V3_STAGING_PERMISSION=1');
    expect(script).toContain('credentials: "omit"');
    expect(script).toContain('redirect: "manual"');
    expect(script).toContain('authenticatedBrowserAcceptance: false');
    expect(script).toContain('independentlyVerifiedHostingMetadata: false');
  });
});
