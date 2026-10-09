import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const route = readFileSync(
  join(process.cwd(), "src/features/operations/OperationalProductRoute.tsx"),
  "utf8",
);
const runtime = readFileSync(
  join(process.cwd(), "src/features/operations/operational-product-runtime.ts"),
  "utf8",
);

describe("V2 2D.3 governance product", () => {
  it("states that a second vertical is buyer-evidence blocked instead of claiming support", () => {
    expect(route).toContain("Second vertical rollout is buyer-evidence blocked");
    expect(route).toContain("requires two real buyers sharing the same operating model");
    expect(route).toContain("Cleaning is the only enabled pack here");
    expect(route).not.toContain("Mobile detailing supported");
    expect(route).not.toContain("Property maintenance supported");
  });

  it("degrades safely when vertical/governance tables are not available", () => {
    expect(runtime).toContain("const verticalPackAvailable = !workspaceVerticalRead.error && !verticalVersionRead.error");
    expect(runtime).toContain("const governanceAvailable = !capabilityRead.error && !supportRead.error");
    expect(route).toContain("Vertical-pack governance is not available in this environment");
  });

  it("shows only service-catalog delegation and states scope is not widened", () => {
    expect(route).toContain("Service-catalog management");
    expect(route).toContain("SERVICE_CATALOG_MANAGE");
    expect(route).toContain("keeps their existing branch/tenant scope");
    expect(route).toContain("This does not grant Owner access, all-branch access, workflow publishing, audit export, or support-access control.");
    expect(route).not.toContain("Delegate workflow");
    expect(route).not.toContain("Delegate retention");
  });

  it("presents support access as read-only, temporary, and non-impersonating", () => {
    expect(route).toContain("Temporary read-only support");
    expect(route).toContain("expires within 24 hours");
    expect(route).toContain("never grants impersonation or write access");
    expect(route).toContain("READ_DIAGNOSTICS");
    expect(route).toContain("READ_AUDIT_METADATA");
  });

  it("labels audit export as metadata-only and owner-only", () => {
    expect(route).toContain("Metadata-only audit trail");
    expect(route).toContain("/api/governance/audit-export");
    expect(route).toContain("audit before/after payloads are deliberately excluded");
  });
});
