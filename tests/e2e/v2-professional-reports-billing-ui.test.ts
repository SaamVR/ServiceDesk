import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("V2 professional reports and billing UI", () => {
  it("presents reporting as business performance with real persisted metrics", () => {
    const route = source("src/features/operations/OperationalProductRoute.tsx");
    expect(route).toContain("Operations reporting workspace");
    expect(route).toContain("Business performance");
    expect(route).toContain("Request conversion");
    expect(route).toContain("Scheduled workload");
    expect(route).toContain("Operational risk");
    expect(route).toContain("snapshot.collectedMinor");
  });

  it("separates ServiceDesk subscription billing from customer money", () => {
    const route = source("src/features/operations/OperationalProductRoute.tsx");
    expect(route).toContain("ServiceDesk subscription billing");
    expect(route).toContain("Platform billing is in sandbox mode");
    expect(route).toContain("Customer invoices are separate");
    expect(route).toContain("Open customer invoices");
    expect(route).toContain("snapshot.usage.map");
  });

  it("has responsive executive/admin layouts", () => {
    const css = source("src/features/operations/OperationalProductRoute.module.css");
    expect(css).toContain("reportsWorkspace");
    expect(css).toContain("billingWorkspace");
    expect(css).toContain("reportKpis");
    expect(css).toContain("@media(max-width:760px)");
  });
});
