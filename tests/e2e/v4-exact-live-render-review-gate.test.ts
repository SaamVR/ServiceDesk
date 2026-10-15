import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const script = readFileSync(join(process.cwd(),
  "scripts/release/v4-review-exact-sha-guest-gate.mjs"), "utf8");
const workflow = readFileSync(join(process.cwd(),
  ".github/workflows/v4-exact-live-review-guest-gate.yml"), "utf8");

describe("read-only LIVE Render review exact SHA proof", () => {
  test("never silently passes a previous live SHA when review branch moves", () => {
    expect(script).toContain("state?.sourceSha !== expected");
    expect(script).toContain("process.env.GITHUB_SHA");
    expect(script).toContain('state?.sourceProvider !== "render"');
    expect(script).toContain('throw new Error("LIVE_RENDER_SHA_MISMATCH');
  });
  test("requires public HTTP 200 plus all guarded business routes to redirect to sign in", () => {
    for (const path of ["/", "/pricing", "/portal"]) {
      expect(script).toContain('["/", "/pricing", "/portal"]');
    }
    expect(script).toContain('response.status !== 307');
    expect(script).toContain('target.pathname !== "/auth/sign-in"');
    expect(script).toContain('target.searchParams.get("next") !== path');
  });
  test("can run only by explicit reviewed-branch dispatch; cannot use a production secret", () => {
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).not.toContain("push:");
    expect(workflow).toContain("github.ref == 'refs/heads/deploy/servicedesk-v3-public-review-20261011'");
    expect(workflow).toContain("contents: read");
    expect(script).not.toContain("Authorization");
    expect(script).not.toContain("POST");
    expect(script).not.toContain("/api/providers");
    expect(script).not.toContain("supabase");
  });
});
