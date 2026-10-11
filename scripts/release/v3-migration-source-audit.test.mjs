import { test } from "node:test";
import assert from "node:assert/strict";
import {
  auditPendingNames,
  auditPendingMigrationSources,
  EXPECTED_PENDING_VERSIONS,
  missingOwnerBootstrapSourceMarkers,
} from "./v3-migration-source-audit.mjs";

test("pending owner-onboarding source chain has exactly 0037..0059, not a skipped interval", () => {
  assert.equal(EXPECTED_PENDING_VERSIONS.length, 23);
  assert.equal(EXPECTED_PENDING_VERSIONS[0], "0037");
  assert.equal(EXPECTED_PENDING_VERSIONS.at(-1), "0059");
  const audit = auditPendingMigrationSources();
  assert.equal(audit.result, "SOURCE_CHAIN_PRESENT_DB_APPLICATION_UNVERIFIED");
  assert.equal(audit.sourceOnly, true);
  assert.equal(audit.databaseQueried, false);
  assert.equal(audit.databaseMutated, false);
  assert.equal(audit.ownerBootstrapSourceContract, "PRESENT");
  assert.equal(audit.migrationCount, 23);
  assert.deepEqual(audit.missingVersions, []);
  assert.deepEqual(audit.duplicateVersions, []);
  assert.deepEqual(audit.missingOwnerMarkers, []);
  assert.equal(audit.files[0].file.startsWith("0037_"), true);
  assert.equal(audit.files.at(-1).file.startsWith("0059_"), true);
  assert.ok(audit.files.every(x => /^[a-f0-9]{64}$/.test(x.sha256) && x.bytes > 100));
});

test("source filename validator detects gaps and conflicting versions before operator handoff", () => {
  const all = EXPECTED_PENDING_VERSIONS.map(v => v + "_example.sql");
  assert.equal(auditPendingNames(all).valid, true);
  const missing37 = auditPendingNames(all.filter(x => !x.startsWith("0037_")));
  assert.equal(missing37.valid, false);
  assert.deepEqual(missing37.missing, ["0037"]);
  const duplicate = auditPendingNames([...all, "0059_conflicting.sql"]);
  assert.equal(duplicate.valid, false);
  assert.deepEqual(duplicate.duplicates, ["0059"]);
});

test("owner SQL is not considered ready without verified identity and restrictive execute grants", () => {
  assert.ok(missingOwnerBootstrapSourceMarkers("create function foo()").length > 8);
  const audit = auditPendingMigrationSources();
  assert.equal(audit.ownerBootstrapSourceContract, "PRESENT");
  assert.equal(audit.sourceOnly, true);
  assert.notEqual(audit.result, "MIGRATIONS_APPLIED");
});

test("source audit cannot access the live Supabase database or modify SQL files", () => {
  const src = import.meta.url;
  assert.ok(src.endsWith("/scripts/release/v3-migration-source-audit.test.mjs"));
  const audit = auditPendingMigrationSources();
  const text = JSON.stringify(audit);
  assert.ok(!text.includes("databasePassword"));
  assert.ok(!text.includes("serviceRoleKey"));
  assert.ok(!text.includes("projectId"));
});
