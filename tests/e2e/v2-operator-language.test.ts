import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const modules = readFileSync(join(process.cwd(), "src/features/operations/staff-modules.ts"), "utf8");
const productRoute = readFileSync(join(process.cwd(), "src/features/operations/OperationalProductRoute.tsx"), "utf8");
const previewRoute = readFileSync(join(process.cwd(), "src/features/operations/OperationalRoute.tsx"), "utf8");

describe("V2 operator-facing module language", () => {
  it("uses user-facing eyebrows rather than exposing internal group enum names", () => {
    for (const eyebrow of [
      "Operations",
      "Customer communications",
      "CRM",
      "Sales pipeline",
      "Dispatch",
      "Field operations",
      "Finance",
      "Service quality",
      "Operations control",
      "Insights",
      "Administration",
    ]) {
      expect(modules).toContain(`eyebrow: "${eyebrow}"`);
    }
    expect(productRoute).toContain("eyebrow={config.eyebrow}");
    expect(productRoute).not.toContain("eyebrow={config.group}");
    expect(previewRoute).toContain("{config.eyebrow}");
  });

  it("describes operator jobs instead of implementation concepts", () => {
    expect(modules).toContain("Plan capacity, assign crews, and resolve scheduling conflicts.");
    expect(modules).toContain("Resolve workflow exceptions and failed handoffs that need human action.");
    expect(modules).toContain("Manage the ServiceDesk subscription and workspace usage limits.");
    expect(modules).not.toContain("freshness and conflict review");
    expect(modules).not.toContain("suppression and owned recovery actions");
    expect(modules).not.toContain("Platform billing boundary separate from customer payments");
  });
});
