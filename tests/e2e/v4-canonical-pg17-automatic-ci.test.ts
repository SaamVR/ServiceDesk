import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(join(process.cwd(),
  ".github/workflows/v4-quote-recovery-integrated-pg17.yml"), "utf8");

describe("V4 canonical integration uses GitHub-hosted disposable PG17", () => {
  it("automatically checks each canonical branch integration, independently of a device", () => {
    const push = workflow.split("  push:")[1]?.split("  pull_request:")[0];
    expect(push).toContain("feat/servicedesk-v4-reconciled-qa-shell-20261012");
    expect(workflow).toContain("test \"$(git rev-parse HEAD)\" = \"$GITHUB_SHA\"");
    expect(workflow).toContain("pg17-journal-and-concurrency:");
    expect(workflow).toContain("pg17-two-tenant-crash-recovery:");
    expect(workflow).toContain("private-http-worker-and-source-rc:");
    expect(workflow).toContain('SERVICEDESK_PG17_DISPOSABLE_ONLY: "1"');
    expect(workflow).toContain("image: postgres:17");
  });
});
