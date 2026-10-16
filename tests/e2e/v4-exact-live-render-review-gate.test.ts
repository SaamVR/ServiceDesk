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
    expect(script).toContain('["/", "/pricing", "/portal"]');
    expect(script).toContain('response.status !== 307');
    expect(script).toContain('target.pathname !== "/auth/sign-in"');
    expect(script).toContain('target.searchParams.get("next") !== path');
  });
  test("runs on isolated review push after manual Render promotion without production secrets", () => {
    expect(workflow).toContain("push:");
    expect(workflow).toContain("branches: [deploy/servicedesk-v3-public-review-20261011]");
    expect(workflow).toContain("Manual Render review promotion never reached this SHA");
    // Render autoDeploy OFF must not consume long full-RC runner time waiting
    // for an unrelated manual deployment. Same-sha rerun is the release proof.
    expect(workflow).toContain("for i in $(seq 1 6); do");
    expect(workflow).not.toContain("seq 1 60");
    expect(workflow).toContain("rerun this same pinned-SHA job only after the authorized Render deploy is LIVE");
    expect(workflow).toContain("sleep 8");
    expect(workflow).toContain("j.sourceSha===process.env.GITHUB_SHA");
    expect(workflow).toContain("github.ref == 'refs/heads/deploy/servicedesk-v3-public-review-20261011'");
    expect(workflow).toContain("contents: read");
    expect(script).not.toContain("Authorization");
    expect(script).not.toContain("POST");
    expect(script).not.toContain("/api/providers");
    expect(script).not.toContain("supabase");
  });
});
