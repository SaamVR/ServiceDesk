import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const source = (path: string) => readFileSync(join(root, path), "utf8");
const converted = [
  "inbox",
  "customers",
  "requests",
  "quotes",
  "schedule",
  "jobs",
  "invoices",
  "quality",
  "automations",
  "reports",
  "billing",
  "settings",
];

describe("V2 operational product routing", () => {
  it("removes fixture-first routing from converted staff modules", () => {
    for (const module of converted) {
      const file = source("src/app/app/[workspace]/" + module + "/page.tsx");
      expect(file).toContain("OperationalProductRoute");
      expect(file).not.toContain("OperationalFixtureRoute");
      expect(file).not.toContain("FIXTURE_UI_ONLY");
    }
  });

  it("keeps production data access authenticated and workspace scoped", () => {
    const runtime = source("src/features/operations/operational-product-runtime.ts");
    expect(runtime).toContain("auth.auth.getUser()");
    expect(runtime).toContain('.from("memberships")');
    expect(runtime).toContain('.eq("workspace_id", workspace.id)');
    expect(runtime).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(runtime).not.toContain("PROVIDER_VERIFIED");
  });

  it("uses authoritative V1 command implementations for supported mutations", () => {
    const runtime = source("src/features/operations/operational-product-runtime.ts");
    expect(runtime).toContain("createPostgresConversationFacadeMethods");
    expect(runtime).toContain("createPostgresRequestQuoteCapacityFacadeMethods");
    expect(runtime).toContain("createPostgresManualPaymentQualityFacadeMethods");
    expect(runtime).toContain("Provider delivery remains tracked separately");
  });

  it("keeps unsupported operations disabled instead of faking success", () => {
    const route = source("src/features/operations/OperationalProductRoute.tsx");
    expect(route).toContain("Crew assignment is not exposed by an accepted V1 staff command.");
    expect(route).toContain("No accepted V1 recovery command exists.");
    expect(route).toContain("does not simulate Stripe or provider");
  });
});
