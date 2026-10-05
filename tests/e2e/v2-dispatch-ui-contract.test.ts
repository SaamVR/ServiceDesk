import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const source = (path: string) => readFileSync(join(root, path), "utf8");

describe("V2 dispatcher product UI contract", () => {
  it("uses shared product primitives and explicit timezone formatting", () => {
    const ui = source("src/features/dispatch/DispatcherIntelligence.tsx");
    expect(ui).toContain("@/components/product/PagePrimitives");
    expect(ui).toContain("formatOperationalTime");
    expect(ui).not.toContain('timeZone: "UTC"');
    expect(ui).not.toContain("NOT_SCORED_NO_GEOGRAPHY");
  });

  it("keeps recommendation authority out of local UI mutation", () => {
    const ui = source("src/features/dispatch/DispatcherIntelligence.tsx");
    expect(ui).not.toContain("setVisit");
    expect(ui).not.toContain("setCrew");
    expect(ui).not.toContain("optimistic");
    expect(ui).toContain("Approval required");
  });
});
