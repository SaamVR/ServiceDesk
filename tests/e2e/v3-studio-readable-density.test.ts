import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const styles = [
  "src/features/operations/OperationalProductRoute.module.css",
  "src/features/operations/StaffOverviewDashboard.module.css",
  "src/components/product/StaffWorkspaceV3.module.css",
  "src/features/operations/RecordDirectorySearch.module.css",
  "src/features/operations/JobQueueFilters.module.css",
];
const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Studio OS readable workbench metadata", () => {
  it("never hardcodes text smaller than 12px at the standard browser root", () => {
    for (const path of styles) {
      const css = read(path);
      const sizes = [...css.matchAll(/font-size:\s*([.\d]+)rem/g)].map((match) => Number(match[1]));
      expect(sizes.length, path).toBeGreaterThan(0);
      expect(sizes.filter((size) => size < 0.75), path).toEqual([]);
    }
  });
  it("preserves small-viewport layout and visible keyboard focus", () => {
    const operations = read(styles[0]);
    const shell = read(styles[2]);
    expect(operations).toContain("max-width: 800px");
    expect(operations).toContain("max-width: 430px");
    expect(shell).toContain(":focus-visible");
    expect(shell).toContain("prefers-reduced-motion: reduce");
  });
});
