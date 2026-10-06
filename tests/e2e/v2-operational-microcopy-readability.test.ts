import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("V2 operational microcopy readability", () => {
  it("keeps primary operational microcopy above the legacy sub-10px range", () => {
    const operational = source("src/features/operations/OperationalProductRoute.module.css");
    expect(operational).not.toMatch(/font-size:\s*\.5[0-9]rem/);
  });

  it("keeps commercial finance microcopy above the legacy sub-10px range", () => {
    const commercial = source("src/features/commercial/CommercialBillingWorkspace.module.css");
    expect(commercial).not.toMatch(/font-size:\s*\.5[0-9]rem/);
  });

  it("preserves responsive layout breakpoints while increasing text legibility", () => {
    const operational = source("src/features/operations/OperationalProductRoute.module.css");
    const commercial = source("src/features/commercial/CommercialBillingWorkspace.module.css");
    expect(operational).toContain("@media(max-width:760px)");
    expect(operational).toContain("@media(max-width:430px)");
    expect(commercial).toContain("@media (max-width: 720px)");
    expect(commercial).toContain("@media (max-width: 430px)");
  });
});
