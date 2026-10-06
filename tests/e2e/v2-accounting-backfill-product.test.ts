import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("V2 accounting dry-run backfill product surface", () => {
  it("plans only for a READY accounting integration", () => {
    const runtime = source("src/features/commercial/commercial-finance-runtime.ts");
    expect(runtime).toContain('integration.status === "READY"');
    expect(runtime).toContain(".planAccountingBackfill(");
    expect(runtime).toContain("accountingBackfill: accountingBackfillResult?.ok");
  });

  it("labels the backfill as read-only and unsent", () => {
    const workspace = source("src/features/commercial/CommercialBillingWorkspace.tsx");
    expect(workspace).toContain("Dry-run backfill");
    expect(workspace).toContain("candidate");
    expect(workspace).toContain("blocked");
    expect(workspace).toContain("This plan is read-only.");
    expect(workspace).toContain("No accounting records have been sent by the backfill planner.");
  });

  it("keeps the backfill summary responsive", () => {
    const css = source("src/features/commercial/CommercialBillingWorkspace.module.css");
    expect(css).toContain(".accountingBackfill");
    expect(css).toContain(".accountingBackfillStats");
    expect(css).toContain("@media (max-width: 720px)");
  });
});
