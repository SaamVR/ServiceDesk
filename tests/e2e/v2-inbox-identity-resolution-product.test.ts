import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("V2 Inbox verified identity resolution product", () => {
  it("exposes a retry action without a customer picker", () => {
    const route = source("src/features/operations/OperationalProductRoute.tsx");
    expect(route).toContain("Resolve verified identity");
    expect(route).toContain("Only an exact, unique verified contact match can be linked.");
    expect(route).not.toContain('name="customerId"');
  });

  it("uses conversation versioning and authoritative server runtime", () => {
    const route = source("src/features/operations/OperationalProductRoute.tsx");
    const runtime = source("src/features/operations/operational-product-runtime.ts");
    expect(route).toContain('name="expectedVersion" value={selected.version}');
    expect(runtime).toContain("servicedesk_resolve_conversation_verified_identity");
    expect(runtime).toContain("expectedVersion");
    expect(runtime).toContain("More than one verified customer matches this sender.");
  });

  it("states that human takeover remains active after identity resolution", () => {
    const route = source("src/features/operations/OperationalProductRoute.tsx");
    const runtime = source("src/features/operations/operational-product-runtime.ts");
    expect(route).toContain("Human takeover stays active.");
    expect(runtime).toContain("Human takeover remains active for review.");
  });
});
