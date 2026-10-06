import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("V2 tax governance product surface", () => {
  it("loads tax profiles independently from billing/profitability", () => {
    const runtime = source("src/features/commercial/commercial-finance-runtime.ts");
    expect(runtime).toContain("createPostgresTaxProfilePort");
    expect(runtime).toContain(".readTaxProfileSnapshot(resolved.value.actor)");
    expect(runtime).toContain("taxProfilesReady: taxProfileResult.ok");
    expect(runtime).toContain('canManageTax: resolved.value.actor.role === "OWNER"');
  });

  it("makes the no-default and no-auto-application truth explicit", () => {
    const workspace = source("src/features/commercial/CommercialBillingWorkspace.tsx");
    expect(workspace).toContain("A zero tax amount already present in V1 records is not treated as a workspace tax policy.");
    expect(workspace).toContain("automatic application");
    expect(workspace).toContain("Existing quote and invoice tax values remain authoritative.");
    expect(workspace).toContain("does not certify tax correctness");
  });

  it("provides owner draft, review and retire controls", () => {
    const workspace = source("src/features/commercial/CommercialBillingWorkspace.tsx");
    expect(workspace).toContain("Save tax draft");
    expect(workspace).toContain("Record review");
    expect(workspace).toContain("Retire profile");
    expect(workspace).toContain("Dispatcher access is read-only.");
  });

  it("does not present review as automatic tax application", () => {
    const runtime = source("src/features/commercial/commercial-finance-runtime.ts");
    expect(runtime).toContain("Automatic tax application remains off.");
    expect(runtime).toContain("Existing financial records were not recalculated.");
  });

  it("provides responsive tax-governance styling", () => {
    const css = source("src/features/commercial/CommercialBillingWorkspace.module.css");
    expect(css).toContain(".taxPanel");
    expect(css).toContain(".taxProfile");
    expect(css).toContain(".taxReviewForm");
    expect(css).toContain("@media (max-width: 720px)");
    expect(css).toContain("@media (max-width: 430px)");
  });
});
