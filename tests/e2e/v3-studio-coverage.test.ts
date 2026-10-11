import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

function usedStyleNames(source: string) {
  return [...new Set([...source.matchAll(/\bstyles\.(\w+)/g)].map((match) => match[1]))];
}
function stylesheetExports(source: string) {
  return new Set([...source.matchAll(/\.([A-Za-z][A-Za-z0-9_-]*)\b/g)].map((match) => match[1]));
}

describe("Studio OS integrated CSS module coverage", () => {
  it("defines every referenced operations class in its actual CSS module", () => {
    const used = usedStyleNames(read("src/features/operations/OperationalProductRoute.tsx"));
    const defined = stylesheetExports(read("src/features/operations/OperationalProductRoute.module.css"));
    expect(used.length).toBeGreaterThan(250);
    expect(used.filter((name) => !defined.has(name))).toEqual([]);
    expect(defined.has("messageInbound")).toBe(true);
  });

  it("defines all dashboard classes including interpolated KPI and severity states", () => {
    const used = usedStyleNames(read("src/features/operations/StaffOverviewDashboard.tsx"));
    const defined = stylesheetExports(read("src/features/operations/StaffOverviewDashboard.module.css"));
    expect(used.filter((name) => !defined.has(name))).toEqual([]);
    for (const token of [
      "kpi_default", "kpi_warning", "kpi_danger",
      "severity_info", "severity_warning", "severity_critical",
    ]) expect(defined.has(token)).toBe(true);
  });

  it("does not confuse source-level tests with actual visual acceptance", () => {
    const runner = read("tests/e2e/v3-capture-workroom.mjs");
    expect(runner).toContain("Emulation.setDeviceMetricsOverride");
    expect(runner).toContain("independentlyVerifiedSourceSha: false");
    expect(runner).toContain("Horizontal overflow at");
    expect(runner).toContain("320, 390, 834, 1280, 1440");
  });
});
