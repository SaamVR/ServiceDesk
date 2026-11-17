import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";
const source=(path:string)=>readFileSync(path,"utf8");
const candidate="docs/engineering/security/f15-unanswered-lead-atomic-db-candidate.sql";
const fixture="tests/sql/v4-f15-atomic-pg17-fixture.sql";
const suite="tests/sql/v4-f15-atomic-pg17-acceptance.sql";
const concurrency="scripts/release/v4-f15-atomic-pg17-concurrency.sh";
const gh=".github/workflows/v4-f15-atomic-pg17-rc.yml";
describe("F15 independent SQL Critic — only fictional persistence proof",()=>{
 it("keeps candidate SQL away from automatically applied migrations",()=>{
  const sql=source(candidate);
  expect(sql).toContain("NEVER an automatically applied migration");
  expect(sql).toContain("create table public.f15_unanswered_lead_reviews");
  expect(sql).toContain("state = 'OWNER_REVIEW_REQUIRED'");
  expect(sql).toContain("enable row level security");
  expect(sql).toContain("revoke all on public.f15_unanswered_lead_reviews from public, anon, authenticated");
  expect(sql).toContain("to service_role;");
  expect(sql).not.toContain("to authenticated,service_role;");
  expect(sql).not.toMatch(/(?:insert|update|delete)\s+(?:into\s+|from\s+)?public\.(?:outbox_events|workflow_source_events|invoices|payments)/i);
 });
 it("requires source transaction/reply recheck rather than client-provided due",()=>{
  const sql=source(candidate);
  for(const phrase of [
   "pg_advisory_xact_lock",
   "for update of r",
   "servicedesk_f15_message_source_lock",
   "servicedesk_f15_conversation_source_lock",
   "v_last.created_at is distinct from v_inbound",
   "v_prior.source_version is distinct from v_version",
   "v_answered>=v_inbound",
   "clock_timestamp()",
   "v_now<v_due",
   "F15_RESPONSE_HISTORY_AMBIGUOUS",
   "v_linked<>1",
   "on conflict (workspace_id,branch_id,event_key) do nothing",
   "unique (workspace_id,branch_id,request_id,inbound_message_id)",
   "p_input->>'sourceVersion' !~",
  ])expect(sql).toContain(phrase);
  expect(sql).toContain("language plpgsql security invoker");
  expect(sql).toContain("grant execute on function public.servicedesk_claim_f15_unanswered_lead_sla_review(jsonb)");
  expect(sql).not.toContain("customerMessageSent',true");
  expect(sql).not.toContain("'state','PROVIDER_DELIVERED'");
 });
 it("guards isolated PG17 environment and adversarial receipt tests",()=>{
  const workflow=source(gh);
  const concurrencyScript=source(concurrency);
  const acceptance=source(suite);
  expect(source(fixture)).toContain("Fixed IDs are fictional");
  expect(workflow).toContain("postgres:17");
  expect(workflow).toContain("sd_f15_disposable");
  expect(workflow).toContain("persist-credentials: false");
  expect(workflow).toContain("SERVICEDESK_F15_PG17_DISPOSABLE_ONLY: \"1\"");
  expect(concurrencyScript).toContain("F15_DISPOSABLE_PG17_TARGET_REQUIRED");
  expect(concurrencyScript).toContain('"$PGHOST" != "127.0.0.1"');
  expect(concurrencyScript).toContain("PG17_F15_12_SESSION_DEDUP_AND_WRITER_LOCK_PASS");
  expect(concurrencyScript).toContain("F15_PG17_NODE_SQL_SOURCE_EVENT_HASH_MISMATCH");
  expect(acceptance).toContain("F15_TRANSACTION_ROLLBACK_LEAK");
  expect(acceptance).toContain("F15_SAVED_TERMINAL_STATUS_IGNORED");
  expect(acceptance).toContain("F15_REAL_STAFF_REPLY_NOT_ENFORCED");
  expect(acceptance).toContain("F15_UNLINKED_REPLY_HISTORY_IGNORED");
 });
 it("does not misrepresent disposable SQL as a connected Supabase installation",()=>{
  const docs=source("docs/delivery/sonic-f15-pg17-dba-review-20261029.md");
  expect(docs).toContain("UNAPPLIED");
  expect(docs).toContain("owner authorization");
  expect(docs).toContain("P02");
  expect(docs).toContain("READ-ONLY");
  expect(docs).toContain("Do not automatically drop anything in production");
 });
});
