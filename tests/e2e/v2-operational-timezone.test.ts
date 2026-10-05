import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("V2 operational workspace timezone", () => {
  it("formats staff operational timestamps with the authoritative workspace timezone", () => {
    const route = source("src/features/operations/OperationalProductRoute.tsx");
    const uses = route
      .split("\n")
      .filter((line) => line.includes("formatWhen(") && !line.includes("function formatWhen"));

    expect(uses.length).toBeGreaterThan(20);
    expect(uses.every((line) => line.includes("data.workspace.timezone"))).toBe(true);
  });

  it("routes timestamp formatting through the shared product truth helper", () => {
    const route = source("src/features/operations/OperationalProductRoute.tsx");

    expect(route).toContain('import { formatWorkspaceDateTime } from "./product-truth"');
    expect(route).toContain("return formatWorkspaceDateTime(value, timeZone);");
  });
});
