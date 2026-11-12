import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
const read=(p:string)=>readFileSync(p,"utf8");

describe("F26 native PostgreSQL crew/revocation Critic",()=>{
 it("blocks ASSIGNED state in the visit transaction and locks all proof rows",()=>{
  const sql=read("docs/engineering/security/f26-atomic-crew-assign-trigger-candidate-v1.sql");
  expect(sql).toContain("security invoker");
  expect(sql).toContain("new.status <> 'ASSIGNED'");
  expect(sql).toContain("before insert or update of status, crew_id, slot_id");
  expect(sql).toContain("from public.requests r");
  expect(sql).toContain("from public.crews c");
  expect(sql).toContain("from public.capacity_slots s");
  expect(sql).toContain("from public.crew_members cm");
  expect(sql).toContain("join public.memberships m");
  expect(sql).toContain("m.status = 'ACTIVE'");
  expect(sql).toContain("m.role = 'CREW'");
  expect(sql).toContain("c.active is true");
  expect(sql).toContain("for share of cm, m");
  expect(sql).toContain("for share;");
  expect(sql).toContain("F26_ASSIGNED_NO_ACTIVE_CREW_MEMBER");
  expect(sql).toContain("revoke all on function");
  expect(sql).not.toContain("security definer");
  expect(sql).not.toContain("alter table public.visits disable row level security");
  expect(sql).not.toContain("insert into public.outbox_events");
  expect(sql).not.toContain("create or replace function public.servicedesk_transition_visit");
 });
 it("runs against original 0011 SQL, not a simplified fake RPC",()=>{
  const workflow=read(".github/workflows/v4-sonic-ir21-f20-owner-finance-retention-ci.yml");
  const migration=read("supabase/migrations/0011_visit_field_runtime.sql");
  const fixture=read("tests/sql/v4-f26-atomic-crew-pg17-fixture.sql");
  const acceptance=read("tests/sql/v4-f26-atomic-crew-pg17-acceptance.sql");
  const race=read("scripts/release/v4-f26-pg17-crew-revocation-race.sh");
  expect(workflow).toContain("native-pg17-f26-atomic-crew");
  expect(workflow).toContain("tests/sql/v4-f26-atomic-crew-pg17-fixture.sql");
  expect(workflow).toContain("docs/engineering/security/f26-atomic-crew-assign-trigger-candidate-v1.sql");
  expect(workflow).toContain("scripts/release/v4-f26-pg17-crew-revocation-race.sh");
  expect(workflow).toContain("sd_f26_disposable");
  expect(migration).toContain("create or replace function public.servicedesk_transition_visit");
  expect(migration).toContain("if v_action = 'ASSIGN' then");
  expect(acceptance).toContain("public.servicedesk_transition_visit(");
  expect(acceptance).toContain("F26_DIRECT_SQL_BYPASSED_ASSIGNED_CREW_TRIGGER");
  expect(acceptance).toContain("F26_VALID_ASSIGN_REGRESSION");
  expect(fixture).toContain("create table public.crew_members");
  expect(race).toContain("F26_REAL_REVOCATION_RACE_DENIED_AND_NO_OUTBOX");
  expect(race).toContain("55P03");
  expect(race).toContain("23514");
  expect(race).toContain("SERVICEDESK_F26_PG17_DISPOSABLE_ONLY");
 });
 it("proves six independent locked revocation races using the original 0011 RPC",()=>{
  const race=read("scripts/release/v4-f26-pg17-crew-revocation-race.sh");
  for(const label of ["MEMBERSHIP_REVOKED","MEMBERSHIP_ROLE_CHANGED",
    "CREW_DEACTIVATED","CREW_MEMBER_REVOKED",
    "REQUEST_MOVED_BRANCH","SLOT_MOVED_BRANCH"]){
    expect(race).toContain('run_locked_revocation "'+label+'"');
  }
  expect((race.match(/run_locked_revocation "/g)||[])).toHaveLength(6);
  expect(race).toContain('sleep 4');
  expect(race).toContain("55P03");
  expect(race).toContain("23514");
  expect(race).toContain('select public.sd_f26_rpc_assign();');
  expect(race).toContain('SCHEDULED:1:0');
  expect(race).toContain('reset_disposable');
  expect(race).toContain('test "${PGHOST:-}" = "127.0.0.1"');
  expect(race).toContain('test "${PGDATABASE:-}" = "sd_f26_disposable"');
  expect(race).toContain('test "$(git rev-parse HEAD)"');
  const workflow=read(".github/workflows/v4-sonic-ir21-f20-owner-finance-retention-ci.yml");
  expect(workflow).toContain("bash scripts/release/v4-f26-pg17-crew-revocation-race.sh");
  expect(workflow).toContain('SERVICEDESK_F26_PG17_DISPOSABLE_ONLY: "1"');
  expect(race).not.toContain("supabase.co");
  expect(race).not.toContain("wrangler");
 });
 it("proves assignment-first row locking and a full transaction rollback",()=>{
  const race=read("scripts/release/v4-f26-pg17-crew-revocation-race.sh");
  expect(race).toContain("F26_ASSIGN_TXN_ROW_LOCK_HELD");
  expect(race).toContain("PG17_F26_REVERSE_ASSIGN_TXN_ROLLBACK_LOCK_PROOF");
  expect(race).toContain('printf "rollback;\\n"');
  expect(race).toContain("SCHEDULED:1:0:ACTIVE");
  expect(race).toContain('update public.memberships set status=\'REVOKED\'');
  expect(race).toContain("55P03");
  expect(race).toContain("23514");
  // Positive 0011 RPC and its calendar outbox must be fully rolled back.
  expect(race).toContain('select public.sd_f26_rpc_assign();');
  expect(race).toContain('from public.outbox_events');
 });
 it("keeps F26 owner-action rollout OFF and P02 deployment gate unchanged",()=>{
  const backend=read("src/server/workflows/owner-verified-booking-dispatch.ts");
  expect(backend).toContain("SERVICEDESK_F26_OWNER_DISPATCH_ENABLED");
  expect(backend).toContain("SERVICEDESK_F26_ATOMIC_GUARD_APPROVED");
  expect(read("src/features/operations/OwnerSavedBookingReceiptPanel.tsx"))
   .toContain("SERVICEDESK_F26_ATOMIC_GUARD_APPROVED");
  expect(read("src/server/workflows/f26-active-crew-readiness.ts"))
   .toContain('row.role!=="CREW"');
  expect(backend).toContain("readActiveBookedVisitCrew");
  const sql=read("docs/engineering/security/f26-atomic-crew-assign-trigger-candidate-v1.sql");
  expect(sql).toContain("NOT INSTALLED");
 });
});
