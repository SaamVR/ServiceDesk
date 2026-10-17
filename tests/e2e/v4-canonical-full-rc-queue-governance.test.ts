import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("canonical exact-HEAD source/Chrome CI queue governance", () => {
  const full = readFileSync(".github/workflows/v4-reconciled-full-rc.yml", "utf8");
  const worker = readFileSync(".github/workflows/v4-quote-recovery-integrated-pg17.yml", "utf8");

  it("runs only the newest canonical/review revision within its own branch group", () => {
    expect(full).toContain("group: servicedesk-v4-reconciled-rc-${{ github.ref }}");
    expect(full).toContain("cancel-in-progress: true");
    expect(full).toContain("feat/servicedesk-v4-reconciled-qa-shell-20261012");
    expect(full).toContain("deploy/servicedesk-v3-public-review-20261011");
  });

  it("retains complete source/build, Chrome and guest/synthetic gates despite cancellation", () => {
    expect(full).toContain("run: pnpm check:rc");
    expect(full).toContain("name: Setup Chrome");
    expect(full).toContain("v4-studio-guest-release-contract.mjs");
    expect(full).toContain("v3-public-browser-proof.mjs");
    expect(full).toContain("v3-sandbox-browser.mjs");
    expect(full).toContain("servicedesk-v4-reconcile-${{ github.sha }}");
    expect(full).not.toContain("paths-ignore:");
  });

  it("keeps independent PG17/worker proof and its own concurrency scope", () => {
    expect(worker).toContain("group: v4-quote-recovery-integration-${{ github.ref }}");
    expect(worker).toContain("cancel-in-progress: true");
    expect(worker).toContain("pg17-journal-and-concurrency:");
    expect(worker).toContain("pg17-two-tenant-crash-recovery:");
  });
});
