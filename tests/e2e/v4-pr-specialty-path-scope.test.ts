import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const workflow = (name: string) =>
  readFileSync(join(process.cwd(), ".github/workflows", name), "utf8");

describe("V4 specialist CI scoped to actual source domain", () => {
  const postgres = workflow("v4-seven-table-branch-guard-pg17-rc.yml");
  const pricing = workflow("v4-pricing-preflight-rc.yml");
  const full = workflow("v4-controller-pr-full-source-rc.yml");
  const merged = workflow("v4-reconciled-full-rc.yml");

  it("only starts costly PostgreSQL17 on source that changes the real branch guard or its proof", () => {
    for (const path of [
      "supabase/migrations/0053_v2_multibranch_core.sql",
      "supabase/migrations/0062_v4_branch_trigger_rowtype_guard.sql",
      "scripts/release/v4-connected-schema-readonly.sql",
      "tests/sql/v4-branch-trigger-pg17-*.sql",
      "tests/db/v4-branch-trigger-rowtype-migration.test.ts",
      "src/features/operations/operational-product-runtime.ts",
    ]) expect(postgres).toContain(path);
    expect(postgres).toContain("pull_request:");
    expect(postgres).toContain("    paths:");
    expect(postgres).toContain("postgres:17");
    expect(postgres).toContain("Run real historical reproduction and fixed seven-table PG17 trigger proof");
    expect(postgres).toContain("pnpm exec vitest run tests/db/v4-branch-trigger-rowtype-migration.test.ts");
    expect(postgres).not.toContain("paths-ignore:");
  });

  it("requires atomic pricing proof when the owner form, SQL or runtime changes", () => {
    for (const path of [
      "supabase/migrations/0061_v4_owner_first_run_pricing.sql",
      "src/server/core/owner-cleaning-pricing-*.ts",
      "src/features/operations/OwnerCleaningPricingSetupForm.tsx",
      "src/features/operations/owner-pricing-readiness.ts",
      "tests/e2e/v4-owner-first-run-pricing.test.ts",
    ]) expect(pricing).toContain(path);
    expect(pricing).toContain("pull_request:");
    expect(pricing).toContain("    paths:");
    expect(pricing).toContain("pnpm exec vitest run tests/e2e/v4-owner-first-run-pricing.test.ts");
    expect(pricing).not.toContain("paths-ignore:");
  });

  it("keeps the ONE mandatory complete source gate on all controller PRs", () => {
    expect(full).toContain("pull_request:");
    expect(full).toContain("feat/servicedesk-v4-reconciled-qa-shell-20261012");
    expect(full).toContain("pnpm check:rc");
    expect(full).not.toContain("    paths:");
    expect(full).not.toContain("paths-ignore:");
    expect(merged).toContain("Real Chrome synthetic operations journey");
    expect(merged).toContain("Real HTTP guest-route release contract");
  });
});
