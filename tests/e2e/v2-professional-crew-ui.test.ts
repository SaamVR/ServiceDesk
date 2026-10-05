import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("V2 professional crew field UI", () => {
  it("prioritizes the shift, job context and one-hand action flow", () => {
    const ui = source("src/features/crew/CrewFieldAppV2.tsx");
    expect(ui).toContain("Crew workspace");
    expect(ui).toContain("Shift summary");
    expect(ui).toContain("Job instructions");
    expect(ui).toContain("Before & after");
    expect(ui).toContain("Next job action");
    expect(ui).toContain("actionDock");
  });

  it("keeps connection truth explicit without inventing durable offline behavior", () => {
    const ui = source("src/features/crew/CrewFieldAppV2.tsx");
    const sync = source("src/features/crew/sync-state.ts");
    expect(ui).toContain("crewOfflineCapabilityNotice");
    expect(sync).toContain("Changes need a connection");
    expect(ui).not.toContain("Works offline");
    expect(ui).not.toContain("offline mode");
  });

  it("uses responsive mobile-first layout hooks for field work", () => {
    const css = source("src/features/crew/CrewFieldAppV2.module.css");
    expect(css).toContain("@media (max-width: 720px)");
    expect(css).toContain("position: sticky");
    expect(css).toContain("grid-template-columns: 1fr");
  });
});
