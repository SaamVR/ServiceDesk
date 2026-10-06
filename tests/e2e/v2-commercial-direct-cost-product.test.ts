import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("V2 commercial direct cost product surface", () => {
  it("loads direct cost provenance independently from billing and accounting", () => {
    const runtime = source("src/features/commercial/commercial-finance-runtime.ts");
    expect(runtime).toContain("createPostgresCommercialDirectCostPort");
    expect(runtime).toContain(".readCommercialDirectCostSnapshot(resolved.value.actor)");
    expect(runtime).toContain("directCostsReady: directCostResult.ok");
  });

  it("shows estimated and actual cost totals without claiming tax or margin authority", () => {
    const workspace = source("src/features/commercial/CommercialBillingWorkspace.tsx");
    expect(workspace).toContain("Direct costs");
    expect(workspace).toContain("Estimated");
    expect(workspace).toContain("Actual");
    expect(workspace).toContain("Reversal entries preserve the original cost history.");
    expect(workspace).toContain("does not infer or certify tax treatment");
    expect(workspace).not.toContain("Tax due");
    expect(workspace).not.toContain("Certified margin");
  });

  it("keeps direct cost absence truthful", () => {
    const workspace = source("src/features/commercial/CommercialBillingWorkspace.tsx");
    expect(workspace).toContain("No commercial direct costs recorded yet.");
    expect(workspace).toContain("no cost or profitability value is being inferred");
  });

  it("provides responsive direct cost styling", () => {
    const css = source("src/features/commercial/CommercialBillingWorkspace.module.css");
    expect(css).toContain(".costPanel");
    expect(css).toContain(".costSummaryGrid");
    expect(css).toContain(".costSummaryRow");
    expect(css).toContain("@media (max-width: 720px)");
    expect(css).toContain("@media (max-width: 430px)");
  });
});
