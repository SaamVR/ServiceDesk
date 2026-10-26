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
