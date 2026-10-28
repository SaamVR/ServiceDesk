import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
const get=(path:string)=>readFileSync(join(process.cwd(),path),"utf8");
describe("P02 IR15 independent release-safety critic",()=>{
 it("retains final readbacks AFTER both owners complete initial matrix",()=>{
  const s=get("scripts/release/v4-p02-two-owner-readonly-acceptance.mjs");
  const read=s.indexOf('const finalMembership = await scoped("memberships", owner.expectedWorkspace)');
  const branch=s.indexOf('const finalDefault = await scoped("workspace_branches", owner.expectedWorkspace)');
  const rechecks=s.indexOf("for (const recheck of finalAuthorityReadbacks) await recheck();");
  const firstComplete=s.indexOf('checked.push({ owner: owner.tag');
  expect(read).toBeGreaterThan(0);
  expect(branch).toBeGreaterThan(read);
  expect(rechecks).toBeGreaterThan(firstComplete);
  expect(s).toContain("OWNER_AUTHORITY_CHANGED_DURING_AUDIT");
  expect(s).toContain("OWNER_SESSION_EXPIRED_DURING_AUDIT");
  // P23: locally decoded claims cannot stand in for server-validated Auth
  // identity. Both owners must be checked before DB reads AND after the
  // full cross-tenant matrix, using only GET and no service_role credentials.
  const authGate=s.indexOf('const verifyAuthOwner = async owner =>');
  const authFirst=s.indexOf('for (const owner of entries) await verifyAuthOwner(owner);');
  const authFinal=s.lastIndexOf('for (const owner of entries) await verifyAuthOwner(owner);');
  expect(authGate).toBeGreaterThan(0);
  expect(s).toContain('ORIGIN + "/auth/v1/user"');
  expect(s).toContain('method: "GET", redirect: "error"');
  expect(s).toContain('AUTH_SERVER_USER_CHECK_FAILED');
  expect(s).toContain('AUTH_SERVER_OWNER_IDENTITY_UNVERIFIED');
  expect(s).toContain('user.id !== owner.subject');
  expect(s).toContain('user.email_confirmed_at');
  // P24: the server identity cannot silently be banned, anonymous, or
  // using the wrong Auth role/audience even with a matching subject ID.
  expect(s).toContain('claims.aud === "authenticated"');
  expect(s).toContain('claims.is_anonymous === true');
  expect(s).toContain('user.role !== "authenticated"');
  expect(s).toContain('user.aud !== "authenticated"');
  expect(s).toContain('user.banned_until != null');
  expect(s).toContain('AUTH_SERVER_OWNER_BANNED_OR_STATUS_UNVERIFIED');

  expect(authFirst).toBeGreaterThan(authGate);
  expect(authFirst).toBeLessThan(s.indexOf('for (const owner of entries) {'));
  expect(authFinal).toBeGreaterThan(rechecks);
  const authTests=get("scripts/release/tests/v4-p02-two-owner-readonly-acceptance.test.mjs");
  for (const fault of ["authServerFailure","authMismatch","authUnconfirmed","authAnonymous","authChangedAtEnd","authRoleWrong","authAudienceWrong","authBanned","authBanMalformed"])
    expect(authTests).toContain(fault);

  expect(s).toContain("OWNERS_AND_WORKSPACES_MUST_BE_DIFFERENT");
  // An empty foreign request result alone is meaningless unless the owner
  // can read a specifically identified saved request in its own tenant.
  expect(s).toContain("EXPECTED_SAVED_REQUEST_FIXTURE_REQUIRED");
  expect(s).toContain("EXPECTED_OWNER_REQUEST_FIXTURE_MISSING");
  expect(s).toContain("entries[0].expectedRequest === entries[1].expectedRequest");
  expect(s).toContain('foreign.expectedWorkspace, foreign.expectedRequest');
  expect(s).toContain('row.id !== requestId');

 });
 it("keeps privileged registration schema unapplied and deny by default",()=>{
  const candidate=get("docs/engineering/security/p02-owner-registration-db-authorization-candidate.sql");
  expect(candidate).toContain("NOT A MIGRATION, NOT DEPLOYED");
  expect(candidate).toContain("values(true,'CLOSED')");
  expect(candidate).toContain("REGISTRATION_NOT_AUTHORIZED");
  expect(candidate).toContain("g.revoked_at is null");
  expect(candidate).toContain("g.expires_at > pg_catalog.clock_timestamp()");
  expect(candidate).toContain("select c.mode into v_registration_mode");
  expect(candidate).toContain("select true into v_qa_granted");
  const gate = candidate.slice(candidate.indexOf("select c.mode into v_registration_mode"),
      candidate.indexOf("if exists (select 1 from public.workspaces where slug = v_slug)"));
  expect((gate.match(/for share;/g) ?? [])).toHaveLength(2);
  expect(gate).toContain("coalesce(v_qa_granted,false)");

  expect(candidate).not.toContain("g.expires_at > pg_catalog.now()");
  expect(candidate).toContain("revoke all on schema servicedesk_security from public, anon, authenticated;");
  expect(candidate).toContain("from public, anon, authenticated;");
  expect(candidate).toContain("grant execute on function public.servicedesk_register_owner_workspace");
  expect(candidate).not.toMatch(/\b(?:drop schema|truncate table)\b/i);
 });
 it("demands negative grant, RLS/authority and read-only preinstallation evidence",()=>{
  const db=get("tests/sql/p02-owner-registration-db-authorization-pg17.sql");
  const wf=get(".github/workflows/p02-owner-registration-candidate-pg17.yml");
  const readback=get(".github/workflows/v4-p02-final-owner-readback-source-rc.yml");
  expect(db).toContain("P02_DISPOSABLE_PG17_REGISTRATION_DB_AUTHORIZATION_PASS");
  expect(db).toContain("expired_long_transaction");
  expect(wf).toContain("P02_REGISTRATION_READONLY_PREIMAGE_BLOCKED");
  expect(wf).toContain("P02_REGISTRATION_CONCURRENCY_LOCKS_PASS");
  const preflight=get("docs/engineering/security/p02-registration-live-readonly-preflight.sql");
  expect((preflight.match(/pg_catalog\.pg_get_userbyid\(p\.proowner\)/g) ?? [])).toHaveLength(2);
  expect(wf).toContain("preflight accepted changed registration SECURITY DEFINER owner");
  expect(wf).toContain("preflight accepted changed default-branch SECURITY DEFINER owner");
  // Operator-first is the opposite lock acquisition ordering. It must
  // demonstrate an approved actor can register before operator lock changes,
  // then that CLOSED and exact grant revocation both cause denial.
  const operator=get("scripts/release/tests/v4-p02-registration-operator-first-pg17.sh");
  expect(wf).toContain("P02_OPERATOR_FIRST_CONCURRENCY_PASS");
  // Restoring the original unguarded 0059 body without revoking EXECUTE
  // would re-open owner registration. Ensure the rollback fixture keeps
  // authenticated users unable to call the restored function.
  const rollback=get("tests/sql/p02-registration-guard-fail-closed-rollback-pg17.sql");
  expect(wf).toContain("P02_FAIL_CLOSED_REGISTRATION_ROLLBACK_PASS");
  expect(rollback).toContain("P02_ROLLBACK_DISPOSABLE_DB_REQUIRED");
  expect(rollback).toContain("P02_ROLLBACK_GUARD_OR_RPC_PRIVILEGE_LEFT_OPEN");
  expect(rollback).toContain("P02_FAIL_CLOSED_REGISTRATION_ROLLBACK_PASS");
  // P22 lifecycle proof is on one synthetic database with out-of-order
  // 0065 ledger preserved before and after CLOSED install + revoke-first rollback.
  const lifecycle=get("tests/sql/p02-registration-rollback-ledger-disposable-setup-pg17.sql");
  expect(lifecycle).toContain("P02_P22_DISPOSABLE_DB_REQUIRED");
  expect(lifecycle).toContain("P02_P22_BEFORE_INSTALL_LEDGER_PASS");
  expect(lifecycle).toContain("sd_0065_v4_default_branch_membership_authority");
  expect(rollback).toContain("p02-registration-postinstall-readonly-attestation.sql");
  expect(rollback).toContain("P02_P22_ROLLBACK_RPCRIGHTS_CLOSED_PASS");
  const candidateInstall=rollback.indexOf("p02-owner-registration-db-authorization-candidate.sql");
  const closedReceipt=rollback.indexOf("p02-registration-postinstall-readonly-attestation.sql");
  const revokeOnRollback=rollback.indexOf("revoke all on function public.servicedesk_register_owner_workspace");
  expect(candidateInstall).toBeGreaterThan(0);
  expect(closedReceipt).toBeGreaterThan(candidateInstall);
  expect(revokeOnRollback).toBeGreaterThan(closedReceipt);
  expect(wf).toContain("p02-registration-rollback-ledger-disposable-setup-pg17.sql");
  expect(wf).toContain("P02_P22_BEFORE_INSTALL_LEDGER_PASS");
  expect(wf).toContain("P02_REGISTRATION_POSTINSTALL_CLOSED_PASS");
  expect(wf).toContain("P02_P22_ROLLBACK_RPCRIGHTS_CLOSED_PASS");
  expect(wf).toContain("p02-lifecycle-ledger-after.log");

  const revoked=rollback.indexOf("revoke all on function public.servicedesk_register_owner_workspace");
  const restored=rollback.indexOf("execute v_original_ddl");
  expect(revoked).toBeGreaterThan(0);
  expect(restored).toBeGreaterThan(revoked);
  expect(rollback).toContain("exception when insufficient_privilege");
  // The INSTALL receipt is a separate read-only gate, before any QA grants.
  // Exact SQL source fingerprints prevent a comment-only unreviewed change.
  const post=get("docs/engineering/security/p02-registration-postinstall-readonly-attestation.sql");
  const postNegative=get("scripts/release/tests/v4-p02-postinstall-negative-pg17.sh");
  expect(post).toContain("begin transaction read only");
  expect(post).toContain("v_mode_rows <> 1 or v_closed_rows <> 1 or v_qa_grants <> 0");
  expect(post).toContain("md5(v_body) is distinct from 'b24154db78c5f1b210f86c97f896d44d'");
  expect(post).toContain("P02_REGISTRATION_POSTINSTALL_BLOCKED");
  expect(post).toContain("P02_REGISTRATION_POSTINSTALL_CLOSED_PASS");
  // Every table and column ACL right must be denied to both API roles.
  expect(post).toContain("has_any_column_privilege");
  expect(post).toContain("has_table_privilege(api.role_name");
  expect(wf).toContain("P02_POSTINSTALL_DENIED_TABLE_DELETE");
  expect(wf).toContain("P02_POSTINSTALL_DENIED_TABLE_MAINTAIN");
  expect(wf).toContain("P02_POSTINSTALL_DENIED_COLUMN_SELECT");
  expect(post).toContain("owner_registration_control_mode_check");
  expect(post).toContain("owner_registration_grants_user_id_fkey");
  expect(post).toContain("protected table constraint drift");
  expect(wf).toContain("P02_POSTINSTALL_DENIED_MODE_CHECK_DROPPED");
  // P20: pinned exact constraints and private ownership cannot be weakened.
  expect(post).toContain("and c.convalidated");
  expect(post).toContain("pg_get_constraintdef(c.oid) =");
  expect(post).toContain("pg_get_userbyid(n.nspowner)");
  expect(post).toContain("not t.tgisinternal");
  expect(post).toContain("pg_rewrite rw");
  expect(post).toContain("protected schema owner or trigger/rule drift");
  for (const tag of [
    "MODE_CHECK_WEAKENED", "SCHEMA_OWNER_DRIFT", "TABLE_OWNER_DRIFT",
    "EXTRA_TRIGGER", "EXTRA_RULE"
  ]) {
    expect(wf).toContain("P02_POSTINSTALL_DENIED_" + tag);
    expect(postNegative).toContain("assert_blocked " + tag);
  }
  expect(post).toContain("protected control defaults drift");
  expect(post).toContain("v_config is distinct from 'search_path=pg_catalog, public, pg_temp'");
  for (const marker of [
    "MODE_DEFAULT_PUBLIC", "SINGLETON_DEFAULT_DROPPED", "EXTRA_FUNCTION_GUC"
  ]) {
    expect(wf).toContain("P02_POSTINSTALL_DENIED_" + marker);
    expect(postNegative).toContain("assert_blocked " + marker);
  }
  expect(postNegative).toContain("P18_UNREVIEWED_COMMENT_BODY_DRIFT");
  expect(postNegative).toContain("P02_POSTINSTALL_NEGATIVE_MATRIX_PASS");
  expect(wf).toContain("P02_POSTINSTALL_DENIED_BODY_HASH");
  expect(wf).toContain("servicedesk_p02_postinstall_negative");
  // P21 out-of-order migration ledger is a separate read-only pre-install
  // guard; these are disposable PG17 tests, NOT Supabase migration authority.
  const ledger=get("docs/engineering/security/p02-registration-migration-ledger-readonly-gate.sql");
  const ledgerNeg=get("scripts/release/tests/v4-p02-migration-ledger-negative-pg17.sh");
  const ledgerSetup=get("tests/sql/p02-registration-migration-ledger-disposable-setup-pg17.sql");
  expect(ledger).toContain("begin transaction read only");
  expect(ledger).toContain("P02_MIGRATION_LEDGER_BLOCKED");
  expect(ledger).toContain("P02_MIGRATION_LEDGER_READONLY_PASS");
  expect(ledger).toContain("sd_0065_v4_default_branch_membership_authority");
  expect(ledger).toContain("sd_0062_v4_branch_trigger_rowtype_guard");
  expect(ledger).toContain("name ~ '^sd_006[34]'");
  expect(ledgerSetup).toContain("P02_LEDGER_DISPOSABLE_DATABASE_REQUIRED");
  expect(ledgerNeg).toContain("P02_LEDGER_DISPOSABLE_ONLY");
  expect(ledgerNeg).toContain("P02_LEDGER_WRONG_FAILURE_");
  for (const marker of ["MISSING_0065", "RENAMED_0065", "MISSING_0062", "UNREVIEWED_0063", "UNREVIEWED_0064", "UNREVIEWED_0063A", "UNREVIEWED_0064A", "DUPLICATE_0065_NAME", "RENAMED_0062"]) {
    expect(wf).toContain("P02_LEDGER_DENIED_" + marker);
    expect(ledgerNeg).toContain("assert_blocked " + marker);
  }
  expect(wf).toContain("P02_LEDGER_NEGATIVE_MATRIX_PASS");
  expect(ledgerNeg).toContain("P02_LEDGER_NEGATIVE_MATRIX_PASS");


  expect(wf).toContain("P02_OPERATOR_CLOSED_WINS_PASS");
  expect(wf).toContain("P02_OPERATOR_REVOCATION_WINS_PASS");
  expect(operator).toContain("P02_APPROVED_PRECONDITION_PASS");
  expect(operator).toContain("P02_OPERATOR_WIN_RETAINED_UNAUTHORIZED_WORKSPACE_OR_LOST_REVOCATION");
  expect(operator).toContain("REGISTRATION_NOT_AUTHORIZED");

  const concurrency=get("scripts/release/tests/v4-p02-registration-concurrent-revocation-pg17.sh");
  expect(concurrency).toContain("P02_CONCURRENCY_FIXTURE_ONLY");
  expect(concurrency).toContain("P02_QA_GRANT_REVOCATION_RACED_IN_FLIGHT_REGISTRATION");
  expect(concurrency).toContain("P02_CONTROL_KILL_SWITCH_WRITE_RACED_IN_FLIGHT_REGISTRATION");
  expect(wf).toContain("P02_FRESH_BASELINE_PREFLIGHT_PASS");
  expect(wf).toContain("preflight accepted anonymous registration RPC");
  expect(wf).toContain("preflight accepted authenticated CREATE on privileged search_path schema");
  expect(readback).toContain("v4-p02-mid-audit-authority-revocation.test.mjs");
  expect(wf).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  expect(readback).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
 });
 it("preserves database-denied registration and trusted workspace error presentation",()=>{
  const action=get("src/app/auth/create-workspace/actions.ts");
  const page=get("src/app/auth/create-workspace/page.tsx");
  const trusted=get("src/features/auth/workspace-registration-error.ts");
  const actionTest=get("tests/e2e/p02-registration-denial-action.test.ts");
  const pageTest=get("tests/e2e/p02-workspace-error-origin.test.ts");
  expect(action).toContain('result?.code === "REGISTRATION_NOT_AUTHORIZED"');
  expect(action).toContain("result?.ok !== true");
  expect(action).toContain('typeof result.slug !== "string"');
  expect(page).toContain("trustedWorkspaceRegistrationError(query.error)");
  expect(page).not.toContain("{query.error}");
  expect(trusted).toContain("knownMessages.has(raw)");
  expect(actionTest).toContain("REGISTRATION_NOT_AUTHORIZED");
  expect(pageTest).toContain("does not render untrusted URL instructions as product errors");
 });
 it("requires real owner A/B, SQL owner approval and separate deploy authority",()=>{
  const doc=get("docs/delivery/sonic-p02-ir15-production-decision-20261026.md");
  expect(doc).toContain("NO LIVE TWO-OWNER ACCEPTANCE");
  expect(doc).toContain("SQL NOT INSTALLED");
  expect(doc).toContain("Vercel deployment not authorized");
  expect(doc).toContain("P02 #818");
  expect(doc).toContain("0065");
  expect(doc).toContain("0063/0064");
 });
});
