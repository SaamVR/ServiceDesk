#!/usr/bin/env node
/**
 * Source-only, READ-ONLY V3 migration audit for the blocked owner-onboarding
 * schema chain 0037..0059. No Supabase connection, SQL execution or mutation.
 *
 * Usage: node scripts/release/v3-migration-source-audit.mjs
 *
 * OUTPUT IS NOT PROOF THAT ANY PENDING MIGRATION WAS APPLIED.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const EXPECTED_PENDING_VERSIONS = Object.freeze(
  Array.from({ length: 23 }, (_, i) => String(i + 37).padStart(4, "0")),
);
const migrationPattern = /^(\d{4})_[a-z0-9_]+\.sql$/;

export function auditPendingNames(filenames) {
  const byVersion = new Map();
  for (const file of filenames) {
    const match = migrationPattern.exec(file);
    if (!match || !EXPECTED_PENDING_VERSIONS.includes(match[1])) continue;
    byVersion.set(match[1], [...(byVersion.get(match[1]) ?? []), file]);
  }
  const missing = EXPECTED_PENDING_VERSIONS.filter(version => !byVersion.has(version));
  const duplicates = [...byVersion.entries()]
    .filter(([, files]) => files.length !== 1)
    .map(([version]) => version);
  return {
    valid: missing.length === 0 && duplicates.length === 0,
    missing,
    duplicates,
    ordered: EXPECTED_PENDING_VERSIONS.flatMap(version => byVersion.get(version) ?? []),
  };
}

const requiredOwnerSourceMarkers = [
  "create or replace function public.servicedesk_register_owner_workspace(",
  "security definer",
  "set search_path = pg_catalog, public, pg_temp",
  "auth.uid()",
  "email_confirmed_at is not null",
  "is_anonymous is not true",
  "pg_advisory_xact_lock",
  "insert into public.workspaces",
  "insert into public.memberships",
  "insert into public.workspace_branches",
  "insert into public.branch_memberships",
  "insert into public.audit_events",
  "revoke all on function public.servicedesk_register_owner_workspace",
  "from public, anon, authenticated;",
  "grant execute on function public.servicedesk_register_owner_workspace",
  "to authenticated;",
];

export function missingOwnerBootstrapSourceMarkers(sql) {
  const normalized = sql.toLowerCase();
  return requiredOwnerSourceMarkers.filter(marker => !normalized.includes(marker));
}

export function auditPendingMigrationSources(root = sourceRoot) {
  const dir = join(root, "supabase", "migrations");
  const names = auditPendingNames(readdirSync(dir));
  const ordered = names.ordered.map(name => {
    const source = join(dir, name);
    if (!existsSync(source)) throw new Error("Required source path is missing.");
    const contents = readFileSync(source);
    return {
      file: name,
      sha256: createHash("sha256").update(contents).digest("hex"),
      bytes: contents.length,
    };
  });
  const ownerSource = ordered.find(entry => entry.file.startsWith("0059_"));
  const ownerMissing = ownerSource
    ? missingOwnerBootstrapSourceMarkers(readFileSync(join(dir, ownerSource.file), "utf8"))
    : requiredOwnerSourceMarkers;
  return {
    result: names.valid && ownerMissing.length === 0
      ? "SOURCE_CHAIN_PRESENT_DB_APPLICATION_UNVERIFIED"
      : "SOURCE_CHAIN_BLOCKED",
    sourceOnly: true,
    databaseQueried: false,
    databaseMutated: false,
    ownerBootstrapSourceContract: ownerMissing.length === 0 ? "PRESENT" : "INCOMPLETE",
    missingVersions: names.missing,
    duplicateVersions: names.duplicates,
    missingOwnerMarkers: ownerMissing,
    migrationCount: ordered.length,
    requiredStart: "0037",
    requiredEnd: "0059",
    files: ordered,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = auditPendingMigrationSources();
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    if (result.result !== "SOURCE_CHAIN_PRESENT_DB_APPLICATION_UNVERIFIED") process.exitCode = 1;
  } catch {
    process.stderr.write(JSON.stringify({
      result: "SOURCE_CHAIN_BLOCKED",
      reason: "Required local migration files could not be inspected",
    }) + "\n");
    process.exitCode = 2;
  }
}
