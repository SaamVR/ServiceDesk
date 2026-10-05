import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const source = (path: string) => readFileSync(join(root, path), "utf8");

describe("V2 field production copy and route truth", () => {
  it("removes fixture routes from the production crew URLs", () => {
    expect(source("src/app/crew/today/page.tsx")).not.toContain("OperationalFixtureRoute");
    expect(source("src/app/crew/jobs/[id]/page.tsx")).not.toContain("OperationalFixtureRoute");
  });

  it("keeps internal implementation language out of field-worker UI copy", () => {
    const ui = source("src/features/crew/CrewFieldAppV2.tsx");
    for (const internal of ["authoritative", "FIXTURE_UI_ONLY", "SESSION_MEMORY_ONLY", "acceptance", "server snapshot"]) {
      expect(ui).not.toContain(internal);
    }
  });

  it("keeps deployment and architecture wording out of crew-facing runtime errors", () => {
    const runtime = source("src/features/crew/crew-product-runtime.ts");
    expect(runtime).not.toContain("not connected on this deployment");
    expect(runtime).toContain("Crew jobs are temporarily unavailable");
  });

  it("does not claim durable offline support", () => {
    const sync = source("src/features/crew/sync-state.ts");
    expect(sync).toContain("SESSION_MEMORY_ONLY");
    expect(sync).toContain("Changes need a connection");
    expect(sync).not.toContain("full offline");
    expect(sync).not.toContain("works offline");
    expect(sync).not.toContain("offline mode");
  });
});
