import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildMigrationRehearsalPlan,
  validateMigrationRehearsalReceipt,
  type V2MigrationRehearsalReceipt,
} from "../../src/server/release/migration-rehearsal";

const buildSha = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const migrationFiles = readdirSync(join(process.cwd(), "supabase/migrations"))
  .filter((file) => file.endsWith(".sql"));

describe("V2 migration rehearsal readiness", () => {
  it("fingerprints the exact ordered repository migration inventory", () => {
    const plan = buildMigrationRehearsalPlan({ buildSha, migrationFiles });
    expect(plan.migrationFiles).toEqual([...migrationFiles].sort((a, b) => a.localeCompare(b)));
    expect(plan.migrationHead).toBe("0058_v2_enterprise_governance.sql");
    expect(plan.planFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(plan).toMatchObject({
      targetClass: "DISPOSABLE_NON_PRODUCTION",
      dataClass: "SYNTHETIC_ONLY",
      rollbackMode: "DATABASE_RESTORE_OR_DISPOSABLE_RESET",
    });
  });

  it("rejects malformed, duplicate, or non-SQL inventory", () => {
    expect(() => buildMigrationRehearsalPlan({ buildSha, migrationFiles: [] })).toThrow();
    expect(() => buildMigrationRehearsalPlan({
      buildSha,
      migrationFiles: ["0058_v2_enterprise_governance.sql", "0058_v2_enterprise_governance.sql"],
    })).toThrow(/duplicate/i);
    expect(() => buildMigrationRehearsalPlan({ buildSha, migrationFiles: ["README.md"] })).toThrow();
  });

  it("accepts only synthetic disposable upgrade/rollback/cleanup PASS bound to exact build and fingerprint", () => {
    const plan = buildMigrationRehearsalPlan({ buildSha, migrationFiles });
    const receipt: V2MigrationRehearsalReceipt = {
      schema: "servicedesk-v2-migration-rehearsal-v1",
      buildSha,
      migrationHead: plan.migrationHead,
      planFingerprint: plan.planFingerprint,
      targetClass: "DISPOSABLE_NON_PRODUCTION",
      dataClass: "SYNTHETIC_ONLY",
      rollbackMode: "DATABASE_RESTORE_OR_DISPOSABLE_RESET",
      upgradeResult: "PASS",
      rollbackResult: "PASS",
      cleanupResult: "PASS",
      capturedAt: "2026-10-10T00:00:00.000Z",
      redactedReference: "rehearsal:redacted:run-001",
    };
    expect(validateMigrationRehearsalReceipt({ plan, receipt }))
      .toEqual({ accepted: true, code: "REHEARSAL_ACCEPTED" });
  });

  it("rejects build drift, failed rollback and unsafe evidence references", () => {
    const plan = buildMigrationRehearsalPlan({ buildSha, migrationFiles });
    const receipt: V2MigrationRehearsalReceipt = {
      schema: "servicedesk-v2-migration-rehearsal-v1",
      buildSha,
      migrationHead: plan.migrationHead,
      planFingerprint: plan.planFingerprint,
      targetClass: "DISPOSABLE_NON_PRODUCTION",
      dataClass: "SYNTHETIC_ONLY",
      rollbackMode: "DATABASE_RESTORE_OR_DISPOSABLE_RESET",
      upgradeResult: "PASS",
      rollbackResult: "PASS",
      cleanupResult: "PASS",
      capturedAt: "2026-10-10T00:00:00.000Z",
      redactedReference: "rehearsal:redacted:run-001",
    };
    expect(validateMigrationRehearsalReceipt({
      plan,
      receipt: { ...receipt, buildSha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" },
    }).code).toBe("REHEARSAL_BUILD_MISMATCH");
    expect(validateMigrationRehearsalReceipt({
      plan,
      receipt: { ...receipt, rollbackResult: "FAIL" },
    }).code).toBe("REHEARSAL_RESULT_NOT_PASS");
    expect(validateMigrationRehearsalReceipt({
      plan,
      receipt: { ...receipt, redactedReference: "https://example.test/full-log" },
    }).code).toBe("REHEARSAL_REFERENCE_INVALID");
  });
});
