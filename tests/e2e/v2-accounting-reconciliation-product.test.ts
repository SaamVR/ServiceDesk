import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("V2 accounting reconciliation product surface", () => {
  it("loads reconciliation independently from commercial billing commands", () => {
    const runtime = source("src/features/commercial/commercial-finance-runtime.ts");
    expect(runtime).toContain("createPostgresAccountingReconciliationReader");
    expect(runtime).toContain(".readAccountingReconciliationSnapshot(resolved.value.actor)");
    expect(runtime).toContain("accountingReady: accountingResult.ok");
    expect(runtime).toContain("accounting: accountingResult.ok ? accountingResult.value : undefined");
  });

  it("shows truthful provider and conflict state without credential details", () => {
    const workspace = source("src/features/commercial/CommercialBillingWorkspace.tsx");
    expect(workspace).toContain("Accounting sync");
    expect(workspace).toContain("No accounting provider is connected.");
    expect(workspace).toContain("External export remains off until an accounting provider is explicitly configured.");
    expect(workspace).toContain("Reconciliation needs review");
    expect(workspace).toContain("provider credentials are not shown");
    expect(workspace).not.toMatch(/client secret|refresh token|access token/i);
  });

  it("keeps ServiceDesk financial authority explicit", () => {
    const workspace = source("src/features/commercial/CommercialBillingWorkspace.tsx");
    expect(workspace).toContain("ServiceDesk keeps invoice and payment truth authoritative");
    expect(workspace).toContain("Contract billing continues normally; no external accounting export is being attempted.");
  });

  it("provides responsive accounting metrics", () => {
    const css = source("src/features/commercial/CommercialBillingWorkspace.module.css");
    expect(css).toContain(".accountingPanel");
    expect(css).toContain(".accountingMetrics");
    expect(css).toContain(".accountingConnection");
    expect(css).toContain("@media (max-width: 720px)");
    expect(css).toContain("@media (max-width: 430px)");
  });
});
