import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const route = readFileSync(
  join(process.cwd(), "src/features/operations/OperationalProductRoute.tsx"),
  "utf8",
);

describe("V2 release-readiness Settings surface", () => {
  it("shows conservative evidence states and blocking count", () => {
    expect(route).toContain("V2 release readiness");
    expect(route).toContain("Release blockers");
    expect(route).toContain("releaseReadiness.blockingCount");
    expect(route).toContain("releaseReadiness.productionReleaseReady");
  });

  it("keeps evidence values private and only shows a short build identifier", () => {
    expect(route).toContain('releaseReadiness.buildSha?.slice(0, 12) ?? "unbound"');
    expect(route).not.toContain("SERVICEDESK_CANONICAL_RC_RECEIPT");
    expect(route).not.toContain("SERVICEDESK_BROWSER_ACCEPTANCE_RECEIPT");
    expect(route).not.toContain("SERVICEDESK_MIGRATION_REHEARSAL_RECEIPT");
  });

  it("states sandbox and buyer-evidence limitations explicitly", () => {
    expect(route).toContain("Payment stays sandbox/demo only.");
    expect(route).toContain("second vertical stays buyer-evidence blocked");
  });
});
