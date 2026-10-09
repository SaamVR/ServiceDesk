import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("V2 professional workspace settings UI", () => {
  it("uses a sectioned owner/admin settings console", () => {
    const route = source("src/features/operations/OperationalProductRoute.tsx");
    expect(route).toContain("Workspace settings console");
    expect(route).toContain('href="#services"');
    expect(route).toContain('href="#team"');
    expect(route).toContain('href="#recurrence"');
    expect(route).toContain('href="#governance"');
    expect(route).toContain('href="#integrations"');
    expect(route).toContain("Workspace configuration summary");
  });

  it("keeps service catalog edits explicitly authorized and stale-write protected", () => {
    const route = source("src/features/operations/OperationalProductRoute.tsx");
    expect(route).toContain("canManageServiceCatalog");
    expect(route).toContain('grant.capability === "SERVICE_CATALOG_MANAGE"');
    expect(route).toContain("updateOperationalServiceCatalogItem");
    expect(route).toContain('name="expectedUpdatedAt"');
    expect(route).toContain("Owner access or an active delegated service-catalog capability");
    expect(route).toContain("Show for new enquiries");
  });

  it("preserves recurrence commands and team privacy boundaries", () => {
    const route = source("src/features/operations/OperationalProductRoute.tsx");
    expect(route).toContain("applyOperationalRecurrenceAction");
    expect(route).toContain('value="PAUSE"');
    expect(route).toContain('value="RESUME"');
    expect(route).toContain('value="SKIP_NEXT"');
    expect(route).toContain("Private credentials and invitation tokens are never displayed");
  });

  it("presents integration readiness without overstating verification", () => {
    const route = source("src/features/operations/OperationalProductRoute.tsx");
    expect(route).toContain('id="integrations"');
    expect(route).toContain("Secret values are never exposed");
    expect(route).toContain("Configuration is not provider verification");
    expect(route).toContain("remain unverified until controlled external receipts are available");
    expect(route).toContain("Payments remain an internal sandbox");
  });

  it("supports a responsive settings navigation and content layout", () => {
    const css = source("src/features/operations/OperationalProductRoute.module.css");
    expect(css).toContain("settingsWorkspace");
    expect(css).toContain("settingsLayout");
    expect(css).toContain("settingsNav");
    expect(css).toContain("integrationGrid");
    expect(css).toContain("@media(max-width:760px)");
  });
});
