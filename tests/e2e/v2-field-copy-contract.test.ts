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
    for (const internal of ["authoritative", "DTO", "FIXTURE_UI_ONLY", "SESSION_MEMORY_ONLY", "acceptance", "server snapshot"]) {
      expect(ui).not.toContain(internal);
    }
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
