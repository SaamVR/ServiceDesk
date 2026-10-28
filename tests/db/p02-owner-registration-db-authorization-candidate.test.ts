import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const candidate = read("docs/engineering/security/p02-owner-registration-db-authorization-candidate.sql");
const baseline = read("supabase/migrations/0059_v3_verified_owner_workspace_bootstrap.sql");
const start = "create or replace function public.servicedesk_register_owner_workspace(";
const guardStart = "  -- P02 defense: signed-in email verification alone is NOT registration";
const guardEnd = "  if exists (select 1 from public.workspaces where slug = v_slug) then";

describe("P02 source-only database-side owner registration authorization", () => {
  it("is an uninstalled candidate, not an automatically applied migration", () => {
    expect(candidate).toContain("NOT A MIGRATION, NOT DEPLOYED");
    expect(candidate).toContain("BEFORE generating/applying a corrective migration");
    expect(candidate).toContain("create schema servicedesk_security");
  });

  it("defaults closed and enforces exact nonrevoked owner grants", () => {
    expect(candidate).toContain("check (mode in ('CLOSED', 'QA_ONLY', 'PUBLIC'))");
    expect(candidate).toContain("values(true,'CLOSED');");
    expect(candidate).toContain("g.user_id = v_actor");
    expect(candidate).toContain("g.revoked_at is null");
    expect(candidate).toContain("g.expires_at > pg_catalog.clock_timestamp()");
    // An operator CLOSED/QA grant revocation must serialize behind the
    // already-admitted registration transaction, not race the insert/audit.
    expect(candidate).toContain("select c.mode into v_registration_mode");
    expect(candidate).toContain("select true into v_qa_granted");
    const gate = candidate.slice(candidate.indexOf("select c.mode into v_registration_mode"),
      candidate.indexOf("if exists (select 1 from public.workspaces where slug = v_slug)"));
    expect((gate.match(/for share;/g) ?? [])).toHaveLength(2);
    expect(gate.indexOf("select true into v_qa_granted"))
      .toBeGreaterThan(gate.indexOf("select c.mode into v_registration_mode"));
    expect(gate).toContain("v_registration_mode is distinct from 'PUBLIC'");
    expect(gate).toContain("coalesce(v_qa_granted,false)");

    expect(candidate).not.toContain("g.expires_at > pg_catalog.now()");
    expect(candidate).not.toContain("g.expires_at is null");
    expect(candidate).toContain("expires_at timestamptz not null");
    expect(candidate).toContain("references auth.users(id) on delete cascade");
    expect(candidate).not.toContain("create table if not exists servicedesk_security");
    expect(candidate).toContain("REGISTRATION_NOT_AUTHORIZED");
    // Comments in the original function mention user_metadata only to reject it.
    // Guard against executable privilege claims, not explanatory comments.
    expect(candidate).not.toMatch(/\braw_user_meta_data\b/);
    expect(candidate).not.toContain("auth.jwt()");
    expect(candidate).not.toContain("auth.jwt()");
  });

  it("blocks client access to both protected control tables", () => {
    for (const table of ["owner_registration_control", "owner_registration_grants"]) {
      expect(candidate).toContain("alter table servicedesk_security." + table + " enable row level security");
      expect(candidate).toContain("revoke all on table servicedesk_security." + table);
    }
    expect(candidate).toContain("revoke all on schema servicedesk_security from public, anon, authenticated");
    expect(candidate).toContain("grant execute on function public.servicedesk_register_owner_workspace");
  });

  it("retains the entire prior verified registration function except the authorization guard", () => {
    const oldStart = baseline.indexOf(start);
    const newStart = candidate.indexOf(start);
    expect(oldStart).toBeGreaterThanOrEqual(0);
    expect(newStart).toBeGreaterThanOrEqual(0);
    const oldFunction = baseline.slice(oldStart);
    const newFunction = candidate.slice(newStart);
    const a = newFunction.indexOf(guardStart);
    const b = newFunction.indexOf(guardEnd);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(b).toBeGreaterThan(a);
    // Only two local scalar state variables may be added outside the guard.
    // The prior registration implementation must otherwise remain byte-exact.
    const restored = (newFunction.slice(0, a) + newFunction.slice(b)).replace(
      "  v_registration_mode text;\n  v_qa_granted boolean := false;\n",
      "",
    );
    expect(restored).toBe(oldFunction);
    expect(a).toBeGreaterThan(newFunction.indexOf("if (v_existing_slug is not null)"));
  });

  it("provides a PostgreSQL 17 two-owner role/expiry/revocation test with no live providers", () => {
    const fixture = read("tests/sql/p02-owner-registration-db-authorization-pg17.sql");
    expect(fixture).toContain("\\i docs/engineering/security/p02-owner-registration-db-authorization-candidate.sql");
    expect(fixture).toContain("set local role authenticated");
    expect(fixture).toContain("P02_DISPOSABLE_PG17_REGISTRATION_DB_AUTHORIZATION_PASS");
    for (const value of ["CLOSED", "QA_ONLY", "PUBLIC", "expired", "revoked_at", "EMAIL_VERIFICATION_REQUIRED", "client_tamper", "kill_switch", "anon_rpc", "deleted_qa_user"]) {
      expect(fixture.toLowerCase()).toContain(value.toLowerCase());
    }
    const preflight = read("docs/engineering/security/p02-registration-live-readonly-preflight.sql");
    expect(preflight).toContain("begin transaction read only");
    expect(preflight).toContain("P02_REGISTRATION_READONLY_PREIMAGE_PASS");
    expect(preflight).toContain("P02_REGISTRATION_READONLY_PREIMAGE_BLOCKED");
    expect(preflight).toContain("select 1 / 0 as p02_preimage_blocked");
    expect(preflight).toContain("e4de11c0b1b6736e46e201ee491d908f");
    expect(preflight).toContain("9f14160f16e16ffe6ac16f35c3f4557f");
    expect(preflight).toContain("has_schema_privilege('anon', 'public', 'CREATE')");
    expect(preflight).toContain("has_schema_privilege('authenticated', 'public', 'CREATE')");
    expect(preflight).toContain("pg_catalog.pg_get_userbyid(p.proowner)");
    expect((preflight.match(/pg_catalog\.pg_get_userbyid\(p\.proowner\)/g) ?? [])).toHaveLength(2);
    expect(preflight).not.toMatch(/(?:insert into|update\s+public\.|delete from|drop table|create table)/i);
    const negativeSetup = read("tests/sql/p02-registration-preflight-negative-setup-pg17.sql");
    expect(negativeSetup).toContain("\\i supabase/migrations/0059_v3_verified_owner_workspace_bootstrap.sql");
    expect(negativeSetup).toContain("\\i supabase/migrations/0065_v4_default_branch_membership_authority.sql");
    expect(negativeSetup).toContain("\\i docs/engineering/security/p02-registration-live-readonly-preflight.sql");
    expect(negativeSetup).toContain("P02_FRESH_BASELINE_PREFLIGHT_PASS");
    expect(negativeSetup).not.toMatch(/create role (?:anon|authenticated|service_role)/);
    const workflow = read(".github/workflows/p02-owner-registration-candidate-pg17.yml");
    expect(workflow).toContain("image: postgres:17");
    expect(workflow).toContain("tests/sql/p02-owner-registration-db-authorization-pg17.sql");
    expect(workflow).toContain("P02_REGISTRATION_READONLY_PREIMAGE_PASS");
    expect(workflow).toContain("P02_DISPOSABLE_PG17_REGISTRATION_DB_AUTHORIZATION_PASS");
    expect(workflow).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    // The shell fixture uses real independent PostgreSQL transactions.
    // A single mocked SELECT or static SQL check would not prove locking.
    const concurrency = read("scripts/release/tests/v4-p02-registration-concurrent-revocation-pg17.sh");
    expect(workflow).toContain("P02 two-session registration control and grant revocation race");
    expect(workflow).toContain("v4-p02-registration-concurrent-revocation-pg17.sh");
    expect(workflow).toContain("P02_REGISTRATION_CONCURRENCY_LOCKS_PASS");
    expect(concurrency).toContain('P02_CONCURRENCY_FIXTURE_ONLY');
    expect(concurrency).toContain('P02_REGISTRATION_TX_OPEN');
    expect(concurrency).toContain("canceling statement due to lock timeout");
    expect(concurrency).toContain("P02_CONTROL_KILL_SWITCH_WRITE_RACED_IN_FLIGHT_REGISTRATION");
    expect(concurrency).toContain("P02_QA_GRANT_REVOCATION_RACED_IN_FLIGHT_REGISTRATION");
    expect(concurrency).toContain("rollback;");
    expect(concurrency).toContain("P02_REGISTRATION_CONCURRENCY_LOCKS_PASS");
    // A rollback must not restore the unauthorised old RPC with a preserved
    // authenticated EXECUTE grant. Validate original byte preimage,
    // explicit revoke-first ordering, and a real role-level denial.
    const rollback = read("tests/sql/p02-registration-guard-fail-closed-rollback-pg17.sql");
    expect(rollback).toContain("P02_ROLLBACK_DISPOSABLE_DB_REQUIRED");
    expect(rollback).toContain("servicedesk_p02_registration_rollback");
    expect(rollback).toContain("P02_ROLLBACK_PREIMAGE_MISMATCH");
    expect(rollback).toContain("P02_ROLLBACK_GUARD_OR_RPC_PRIVILEGE_LEFT_OPEN");
    expect(rollback).toContain("P02_FAIL_CLOSED_REGISTRATION_ROLLBACK_PASS");
    const revoke = rollback.indexOf("revoke all on function public.servicedesk_register_owner_workspace");
    const restore = rollback.indexOf("execute v_original_ddl");
    const drop = rollback.indexOf("drop schema servicedesk_security cascade");
    expect(revoke).toBeGreaterThan(0);
    expect(restore).toBeGreaterThan(revoke);
    expect(drop).toBeGreaterThan(restore);
    expect(rollback).toContain("exception when insufficient_privilege");
    expect(rollback).toContain("P02_ROLLBACK_CREATED_UNAUTHORIZED_WORKSPACE");
    expect(workflow).toContain("P02 guarded registration fail-closed rollback rehearsal");
    expect(workflow).toContain("tests/sql/p02-registration-guard-fail-closed-rollback-pg17.sql");
    // P22 requires ONE disposable DB lifecycle, not independent successful
    // scripts that never exercised install/rollback against the same ledger.
    const lifecycle = read("tests/sql/p02-registration-rollback-ledger-disposable-setup-pg17.sql");
    expect(lifecycle).toContain("P02_P22_DISPOSABLE_DB_REQUIRED");
    expect(lifecycle).toContain("current_database() <> 'servicedesk_p02_registration_rollback'");
    expect(lifecycle).toContain("P02_P22_BEFORE_INSTALL_LEDGER_PASS");
    // The included read-only SQL emits the PASS marker at runtime; its text
    // is intentionally not duplicated in the wrapper fixture.
    expect(lifecycle).toContain("\\i docs/engineering/security/p02-registration-migration-ledger-readonly-gate.sql");
    expect(workflow).toContain("P02_MIGRATION_LEDGER_READONLY_PASS");
    expect(lifecycle).toContain("sd_0065_v4_default_branch_membership_authority");
    expect(lifecycle).not.toContain("cpmmgivhlkfbiwzhlcey");
    // Postinstall PASS belongs to the included SQL; the workflow verifies it.
    expect(workflow).toContain("P02_REGISTRATION_POSTINSTALL_CLOSED_PASS");
    expect(rollback).toContain("P02_P22_ROLLBACK_RPCRIGHTS_CLOSED_PASS");
    expect(rollback).toContain("p02-registration-postinstall-readonly-attestation.sql");
    const installPosition = rollback.indexOf("p02-owner-registration-db-authorization-candidate.sql");
    const receiptPosition = rollback.indexOf("p02-registration-postinstall-readonly-attestation.sql");
    const revokePosition = rollback.indexOf("revoke all on function public.servicedesk_register_owner_workspace");
    expect(installPosition).toBeGreaterThan(0);
    expect(receiptPosition).toBeGreaterThan(installPosition);
    expect(revokePosition).toBeGreaterThan(receiptPosition);
    expect(workflow).toContain("p02-registration-rollback-ledger-disposable-setup-pg17.sql");
    expect(workflow).toContain("P02_P22_BEFORE_INSTALL_LEDGER_PASS");
    expect(workflow).toContain("P02_P22_ROLLBACK_RPCRIGHTS_CLOSED_PASS");
    expect(workflow).toContain("P02_REGISTRATION_POSTINSTALL_CLOSED_PASS");
    const ledgerBefore = workflow.indexOf("p02-lifecycle-ledger-baseline.log");
    const rollbackRun = workflow.indexOf("-f tests/sql/p02-registration-guard-fail-closed-rollback-pg17.sql");
    const ledgerAfter = workflow.indexOf("p02-lifecycle-ledger-after.log");
    expect(ledgerBefore).toBeGreaterThan(0);
    expect(rollbackRun).toBeGreaterThan(ledgerBefore);
    expect(ledgerAfter).toBeGreaterThan(rollbackRun);

    // INSTALL RECEIPT is separate from the preinstall gate and is strictly
    // read-only, only immediately after installation before any QA grant.
    // A successful source diff or a PG17 candidate is not a live receipt.
    const post = read("docs/engineering/security/p02-registration-postinstall-readonly-attestation.sql");
    const setup = read("tests/sql/p02-registration-postinstall-disposable-setup-pg17.sql");
    const negative = read("scripts/release/tests/v4-p02-postinstall-negative-pg17.sh");
    expect(post).toContain("begin transaction read only;");
    expect(post).toContain("P02_REGISTRATION_POSTINSTALL_BLOCKED");
    expect(post).toContain("P02_REGISTRATION_POSTINSTALL_CLOSED_PASS");
    expect(post).toContain("v_mode_rows <> 1 or v_closed_rows <> 1 or v_qa_grants <> 0");
    expect(post).toContain("has_function_privilege('anon',v_reg,'EXECUTE')");
    expect(post).toContain("aclexplode(coalesce(p.proacl,acldefault('f',p.proowner)))");
    expect(post).toContain("v_rpc_owner is distinct from 'postgres'");
    expect(post).toContain("md5(v_body) is distinct from 'b24154db78c5f1b210f86c97f896d44d'");
    expect(negative).toContain("P18_UNREVIEWED_COMMENT_BODY_DRIFT");
    expect(post).toContain("has_any_column_privilege");
    expect(post).toContain("has_table_privilege(api.role_name");
    for (const aclRight of ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER", "MAINTAIN"]) {
      expect(post).toContain("('" + aclRight + "'::text)");
    }
    expect(post).toContain("direct protected table or column access");
    expect(post).toContain("owner_registration_control_mode_check");
    // Never accept a broadened CHECK just because the named states appear.
    expect(post).toContain("pg_get_constraintdef(c.oid) =");
    expect(post).toContain("and c.convalidated");
    expect(post).toContain("not t.tgisinternal");
    expect(post).toContain("pg_rewrite rw");
    expect(post).toContain("pg_get_userbyid(n.nspowner)");
    expect(post).toContain("protected schema owner or trigger/rule drift");
    expect(post).toContain("owner_registration_grants_user_id_fkey");
    expect(post).toContain("protected table constraint drift");
    expect(post).toContain("v_config is distinct from 'search_path=pg_catalog, public, pg_temp'");
    expect(post).toContain("protected control defaults drift");
    expect(post).toContain("pg_get_expr(d.adbin,d.adrelid)");
    expect(negative).toContain("alter column mode set default 'PUBLIC'");
    expect(negative).toContain("set row_security = off");

    expect(post).toContain("pg_get_constraintdef(c.oid)");
    expect(negative).toContain("drop constraint owner_registration_control_mode_check");

    expect(post).toContain("relrowsecurity");
    expect(post).toContain("9f14160f16e16ffe6ac16f35c3f4557f");
    expect(post).not.toMatch(/(?:create\s+(?:schema|table|function)|insert\s+into|delete\s+from|update\s+\w+\s+set|alter\s+table|drop\s+(?:schema|table|function))\b/i);
    expect(setup).toContain("P02_POSTINSTALL_DISPOSABLE_DB_REQUIRED");
    expect(setup).toContain("P02_POSTINSTALL_DISPOSABLE_BASELINE_PASS");
    expect(negative).toContain("P02_POSTINSTALL_DISPOSABLE_ONLY");
    expect(negative).toContain("P02_POSTINSTALL_NEGATIVE_MATRIX_PASS");
    expect(negative).toContain("P02_POSTINSTALL_WRONG_FAILURE_");
    for (const tag of ["MODE_OPEN","GRANT_PRESENT","ANON_RPC","PUBLIC_RPC","PRIVATE_SCHEMA","TABLE_DELETE","TABLE_MAINTAIN","COLUMN_SELECT","MODE_CHECK_DROPPED","MODE_CHECK_WEAKENED","SCHEMA_OWNER_DRIFT","TABLE_OWNER_DRIFT","EXTRA_TRIGGER","EXTRA_RULE","MODE_DEFAULT_PUBLIC","SINGLETON_DEFAULT_DROPPED","EXTRA_FUNCTION_GUC","RLS_OFF","INVOKER","BODY_HASH"]) {
      expect(workflow).toContain("P02_POSTINSTALL_DENIED_" + tag);
      expect(negative).toContain("assert_blocked " + tag);
    }
    expect(workflow).toContain("servicedesk_p02_postinstall_negative");
    expect(workflow).not.toContain("SUPABASE_SERVICE_ROLE_KEY");

    // P21: existing Supabase ledger 0065 was applied out of order.
    // A separate read-only gate must veto lost 0065 and replayed 0063/0064.
    const ledger = read("docs/engineering/security/p02-registration-migration-ledger-readonly-gate.sql");
    const ledgerSetup = read("tests/sql/p02-registration-migration-ledger-disposable-setup-pg17.sql");
    const ledgerNegatives = read("scripts/release/tests/v4-p02-migration-ledger-negative-pg17.sh");
    expect(ledger).toContain("begin transaction read only;");
    expect(ledger).toContain("P02_MIGRATION_LEDGER_BLOCKED");
    expect(ledger).toContain("P02_MIGRATION_LEDGER_READONLY_PASS");
    expect(ledger).toContain("supabase_migrations.schema_migrations");
    expect(ledger).toContain("sd_0062_v4_branch_trigger_rowtype_guard");
    expect(ledger).toContain("sd_0065_v4_default_branch_membership_authority");
    expect(ledger).toContain("name ~ '^sd_006[34]'");
    expect(ledger).not.toMatch(/(?:create\s+(?:schema|table|function)|insert\s+into|delete\s+from|update\s+\w+\s+set|alter\s+table|drop\s+(?:schema|table|function))\b/i);
    expect(ledgerSetup).toContain("P02_LEDGER_DISPOSABLE_DATABASE_REQUIRED");
    expect(ledgerSetup).toContain("P02_LEDGER_DISPOSABLE_BASELINE_PASS");
    expect(ledgerNegatives).toContain("P02_LEDGER_DISPOSABLE_ONLY");
    expect(ledgerNegatives).toContain("P02_LEDGER_WRONG_FAILURE_");
    for (const tag of ["MISSING_0065", "RENAMED_0065", "MISSING_0062", "UNREVIEWED_0063", "UNREVIEWED_0064", "UNREVIEWED_0063A", "UNREVIEWED_0064A", "DUPLICATE_0065_NAME", "RENAMED_0062"]) {
      expect(workflow).toContain("P02_LEDGER_DENIED_" + tag);
      expect(ledgerNegatives).toContain("assert_blocked " + tag);
    }
    expect(workflow).toContain("P02_LEDGER_NEGATIVE_MATRIX_PASS");
    expect(ledgerNegatives).toContain("P02_LEDGER_NEGATIVE_MATRIX_PASS");
    expect(workflow).toContain("servicedesk_p02_ledger_probe");
    expect(workflow).not.toContain("SUPABASE_SERVICE_ROLE_KEY");

    // Reverse race proof: operator must win when its write takes the lock
    // before the new-owner RPC, with a positive approved registration
    // precondition and no persisted workspace or audit row after denials.
    const operatorFirst = read("scripts/release/tests/v4-p02-registration-operator-first-pg17.sh");
    expect(workflow).toContain("P02 operator-first revocation and CLOSED win PG17 race");
    expect(workflow).toContain("v4-p02-registration-operator-first-pg17.sh");
    for (const marker of [
      "P02_CONCURRENCY_FIXTURE_ONLY",
      "P02_APPROVED_PRECONDITION_PASS",
      "P02_MODE_UPDATE_LOCKED",
      "P02_OPERATOR_CLOSED_WINS_PASS",
      "P02_GRANT_REVOKE_LOCKED",
      "P02_OPERATOR_REVOCATION_WINS_PASS",
      "P02_OPERATOR_WIN_RETAINED_UNAUTHORIZED_WORKSPACE_OR_LOST_REVOCATION",
      "P02_OPERATOR_FIRST_CONCURRENCY_PASS",
    ]) {
      expect(operatorFirst).toContain(marker);
    }
    expect(operatorFirst).toContain("pg_catalog.pg_sleep(2)");
    expect(operatorFirst).toContain("rollback;");
    expect(operatorFirst).toContain("REGISTRATION_NOT_AUTHORIZED");


    expect(workflow).toContain("P02 source preflight fail-closed adversarial proof");
    expect(workflow).toContain("tests/sql/p02-registration-preflight-negative-setup-pg17.sql");
    expect(workflow).toContain("preflight accepted anonymous registration RPC");
    expect(workflow).toContain("preflight accepted changed function security mode");
    expect(workflow).toContain("preflight accepted changed registration function fingerprint");
    expect(workflow).toContain("preflight accepted authenticated CREATE on privileged search_path schema");
    expect(workflow).toContain("preflight accepted changed registration SECURITY DEFINER owner");
    expect(workflow).toContain("preflight accepted changed default-branch SECURITY DEFINER owner");
    expect(workflow).toContain("P02_REGISTRATION_READONLY_PREIMAGE_BLOCKED");
    expect(workflow).toContain("P02_FRESH_BASELINE_PREFLIGHT_PASS");
    // In one transaction a new grant is valid at BEGIN but must be invalid
    // after real time elapses. This catches the now() transaction-clock bypass
    // while all data stays in disposable PostgreSQL, then rolls back.
    expect(fixture).toContain("do $expired_long_transaction$");
    expect(fixture).toContain("select pg_catalog.pg_sleep(1.4)");
    expect(fixture).toContain("Transaction-start time incorrectly accepted expired grant");
    const beg = fixture.indexOf("do $expired_long_transaction$");
    expect(beg).toBeGreaterThan(fixture.indexOf("select pg_catalog.pg_sleep(1.4)"));
    expect(fixture.slice(beg)).toContain("rollback;");
    expect(fixture).toContain("do $expired_rollback$");
  });
});
