import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
const read=(p:string)=>readFileSync(p,"utf8");
describe("F26 independent critic: owner actor authenticity and revocation lock",()=>{
 it("only the existing visit RPC is replaced, preserving security invoker and transactional outbox",()=>{
  const sql=read("docs/engineering/security/f26-owner-role-atomic-assign-rpc-candidate.sql");
  const base=read("supabase/migrations/0011_visit_field_runtime.sql");
  expect(sql).toContain("NOT INSTALLED");
  expect(sql).toContain("create or replace function public.servicedesk_transition_visit(p_input jsonb)");
  expect(sql).toContain("security invoker");
  expect(sql).not.toContain("security definer");
  expect(sql).not.toContain("create extension");
  expect(sql).not.toContain("alter table public.visits disable row level security");
  expect(sql).toContain("for share of staff;");
  expect(sql).toContain("staff.status = 'ACTIVE'");
  expect(sql).toContain("staff.role in ('OWNER','DISPATCHER')");
  expect(sql).toContain("current_user = 'authenticated'");
  expect(sql).toContain("auth.uid() is distinct from v_actor_user");
  expect(sql).toContain("current_user = 'anon'");
  expect(sql).toContain("v_visit.version <> v_expected");
  expect(sql).toContain("calendar.visit.upsert");
  expect(sql).toContain("on conflict (workspace_id, idempotency_key) do nothing");
  expect(base).not.toContain("for share of staff");
 });
 it("independent crew trigger is retained and checks CREW source roles",()=>{
  const trigger=read("docs/engineering/security/f26-atomic-crew-assign-trigger-candidate-v1.sql");
  expect(trigger).toContain("for share of cm, m;");
  expect(trigger).toContain("m.role = 'CREW'");
  expect(trigger).toContain("security invoker");
  const app=read("src/server/workflows/owner-verified-booking-dispatch.ts");
  expect(app).toContain("SERVICEDESK_F26_OWNER_DISPATCH_ENABLED");
  expect(app).toContain("SERVICEDESK_F26_ATOMIC_GUARD_APPROVED");
 });
 it("real PG17 acceptance catches unauthenticated impersonation and revoked owners",()=>{
  const ci=read(".github/workflows/v4-sonic-ir21-f20-owner-finance-retention-ci.yml");
  const acceptance=read("tests/sql/v4-f26-owner-atomic-pg17-acceptance.sql");
  const auth=read("tests/sql/v4-f26-owner-jwt-pg17-auth-fixture.sql");
  expect(ci).toContain("tests/sql/v4-f26-owner-atomic-pg17-acceptance.sql");
  expect(ci).toContain("docs/engineering/security/f26-owner-role-atomic-assign-rpc-candidate.sql");
  expect(auth).toContain("current_setting('request.jwt.claim.sub',true)");
  expect(acceptance).toContain("F26_AUTHENTICATED_OWNER_ID_SPOOF_ALLOWED");
  expect(acceptance).toContain("F26_ANON_OWNER_ID_SPOOF_ALLOWED");
  expect(acceptance).toContain("F26_REVOKED_OWNER_ASSIGNED");
  expect(acceptance).toContain("F26_OWNER_ROLE_CHANGED_ASSIGNED");
 });
 it("two real competing PostgreSQL sessions prove owner-row lock in both orders",()=>{
  const script=read("scripts/release/v4-f26-pg17-owner-revocation-race.sh");
  for(const requirement of ["SERVICEDESK_F26_PG17_DISPOSABLE_ONLY",
   "127.0.0.1","sd_f26_disposable","PGUSER","GITHUB_SHA",
   "55P03","F26_OWNER_REVOCATION_FIRST_LOCK_HELD",
   "F26_OWNER_ASSIGN_FIRST_LOCK_HELD",
   "PG17_F26_OWNER_REVOKE_FIRST_FOR_SHARE_RACE_PASS",
   "PG17_F26_OWNER_ASSIGN_FIRST_LOCK_ROLLBACK_AND_POSITIVE_PASS"])
    expect(script).toContain(requirement);
  for(const forbidden of ["supabase db push","supabase migration up","trigger_deploy","sendEmail("])
    expect(script).not.toContain(forbidden);
 });
});
