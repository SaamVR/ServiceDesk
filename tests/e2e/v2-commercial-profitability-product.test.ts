import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("V2 commercial profitability product surface", () => {
  it("loads a current-month profitability snapshot through the authoritative reader", () => {
    const runtime = source("src/features/commercial/commercial-finance-runtime.ts");
    expect(runtime).toContain("createPostgresCommercialProfitabilityReader");
    expect(runtime).toContain("currentMonthRange");
    expect(runtime).toContain(".readCommercialProfitabilitySnapshot(resolved.value.actor, profitabilityRange)");
    expect(runtime).toContain("profitabilityReady: profitabilityResult.ok");
  });

  it("shows quoted, completed and paid recorded margins by site/service", () => {
    const workspace = source("src/features/commercial/CommercialBillingWorkspace.tsx");
    expect(workspace).toContain("Site &amp; service profitability");
    expect(workspace).toContain("Quoted / contract");
    expect(workspace).toContain("Completed");
    expect(workspace).toContain("Paid exactly");
    expect(workspace).toContain("Recorded margin");
  });

  it("keeps incomplete coverage and partial-payment exclusions visible", () => {
    const workspace = source("src/features/commercial/CommercialBillingWorkspace.tsx");
    expect(workspace).toContain("Estimated cost coverage");
    expect(workspace).toContain("Actual cost coverage");
    expect(workspace).toContain("partial-payment visit");
    expect(workspace).toContain("Partial collections are not prorated across sites or services.");
    expect(workspace).toContain("Missing cost entries remain coverage gaps rather than assumed zero cost.");
  });

  it("keeps unattributed adjustments out of service margin and avoids tax certification", () => {
    const workspace = source("src/features/commercial/CommercialBillingWorkspace.tsx");
    expect(workspace).toContain("Adjustments kept outside service margin");
    expect(workspace).toContain("Credits or charges without a service-level attribution are not distributed across services.");
    expect(workspace).toContain("do not certify tax or complete profitability");
  });

  it("provides responsive profitability styling", () => {
    const css = source("src/features/commercial/CommercialBillingWorkspace.module.css");
    expect(css).toContain(".profitabilityPanel");
    expect(css).toContain(".profitabilityMetrics");
    expect(css).toContain(".profitabilityCoverage");
    expect(css).toContain("@media (max-width: 720px)");
    expect(css).toContain("@media (max-width: 430px)");
  });
});
