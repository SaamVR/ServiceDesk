import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { verifiedHostingCommitIdentity } from "../../src/app/health/deployment-identity";

describe("P02 Vercel manual-deployment-only safety contract", () => {
  it("explicitly disables automatic deployments for ALL Git branches", () => {
    const config = JSON.parse(readFileSync(join(process.cwd(), "vercel.json"), "utf8"));
    expect(config.git).toEqual({ deploymentEnabled: false });
    expect(config.git.deploymentEnabled).toBe(false);
  });

  it("recognizes an authentic Vercel-provided commit SHA for post-approval attestation", () => {
    const commit = "a".repeat(40);
    expect(verifiedHostingCommitIdentity({ VERCEL_GIT_COMMIT_SHA: commit }))
      .toEqual({ sourceSha: commit, sourceProvider: "vercel" });
    expect(verifiedHostingCommitIdentity({ VERCEL_GIT_COMMIT_SHA: "unverified" }))
      .toBeUndefined();
    expect(verifiedHostingCommitIdentity({
      VERCEL_GIT_COMMIT_SHA: "a".repeat(40),
      RENDER_GIT_COMMIT: "b".repeat(40),
    })).toBeUndefined();
  });

  it("never treats manually authored SHA claims as a hosting provenance signal", () => {
    expect(verifiedHostingCommitIdentity({
      SERVICEDESK_CANONICAL_RC_BUILD_SHA: "a".repeat(40),
      GITHUB_SHA: "a".repeat(40),
    })).toBeUndefined();
  });
});
