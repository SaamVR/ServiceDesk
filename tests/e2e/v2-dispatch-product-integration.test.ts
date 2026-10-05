import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("V2 dispatch product integration", () => {
  it("wires the schedule approval control to the authoritative crew assignment action", () => {
    const route = source("src/features/operations/OperationalProductRoute.tsx");
    expect(route).toContain("assignOperationalCrew");
    expect(route).toContain('name="expectedVersion"');
    expect(route).toContain('assignmentAvailability={{ enabled: true');
    expect(route).toContain("renderApprovalControl");
  });

  it("keeps crew candidates workspace-scoped and presents workspace timezone", () => {
    const adapter = source("src/features/operations/dispatch-product-adapter.ts");
    const runtime = source("src/features/operations/operational-product-runtime.ts");
    expect(adapter).toContain("workspaceId: data.workspace.id");
    expect(runtime).toContain('.select("id,slug,name,timezone")');
  });
});
