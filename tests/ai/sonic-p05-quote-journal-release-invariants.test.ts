import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isVerifiedAcceptedQuoteMilestone } from "../../src/server/workflows/accepted-quote-milestone";
const read=(p:string)=>readFileSync(join(process.cwd(),p),"utf8");
const journal=read("supabase/migrations/0063_v4_quote_accept_internal_source_journal.sql");
const bridge=read("src/server/workflows/customer-quote-accepted-bridge.ts");
const worker=read("src/server/workflows/customer-quote-source-recovery.ts");

describe("SONIC P05 quote accepted durable event — migration-gated source proof, not live acceptance",()=>{
 it("rejects forged financial success from just an ACCEPTED flag",()=>{
  expect(isVerifiedAcceptedQuoteMilestone({status:"ACCEPTED",currency:"USD"})).toBe(false);
  expect(isVerifiedAcceptedQuoteMilestone({status:"ACCEPTED",currency:"USD",
    subtotal_minor:1000,tax_minor:200,total_minor:1200,
    deposit_minor:0,balance_minor:1200,duration_minutes:60,
    snapshot:{}})).toBe(false);
  expect(isVerifiedAcceptedQuoteMilestone({status:"SENT",currency:"USD",
    subtotal_minor:1000,tax_minor:200,total_minor:1200,
    deposit_minor:0,balance_minor:1200,duration_minutes:60})).toBe(false);
 });
 it("0063 sources accepted quote only inside the same transaction and scoped unique event",()=>{
  expect(journal).toContain("create table if not exists public.workflow_source_events");
  expect(journal).toContain("after update of status on public.quotes");
  expect(journal).toContain("for each row execute function public.servicedesk_record_accepted_quote_source()");
  expect(journal).toContain("new.status::text = 'ACCEPTED'");
  expect(journal).toContain("old.status::text is distinct from 'ACCEPTED'");
  expect(journal).toContain("f.workspace_id = new.workspace_id");
  expect(journal).toContain("f.feature_key = 'AUTO_INTERNAL_QUOTE_ACCEPTED'");
  expect(journal).toContain("f.enabled is true");
  expect(journal).toContain("unique (workspace_id, event_type, quote_id)");
  expect(journal).toContain("on conflict (workspace_id,event_type,quote_id) do nothing");
 });
 it("0063 keeps source journal out of provider outbox and unreadable to direct tenant client",()=>{
  expect(journal).toContain("alter table public.workflow_source_events enable row level security");
  expect(journal).toContain("revoke all on public.workflow_source_events from public, anon, authenticated");
  expect(journal).toContain("grant select, insert, update on public.workflow_source_events to service_role");
  expect(journal).toContain("from public,anon,authenticated");
  expect(journal).toContain("Do NOT apply");
  expect(journal).not.toMatch(/insert\s+into\s+public\.outbox_events\b/i);
 });
 it("lease reclaim is bounded, unique, retry/dead-letter and only persisted by SQL claim",()=>{
  expect(journal).toContain("for update skip locked");
  expect(journal).toContain("attempts < 8");
  expect(journal).toContain("attempts >= 8");
  expect(journal).toContain("locked_by = p_worker");
  expect(journal).toContain("locked_until = now() + interval '90 seconds'");
  expect(journal).toContain("state='DEAD_LETTER'");
  expect(journal).toContain("state='RETRY_PENDING'");
  expect(journal).toContain("p_outcome not in ('SUCCEEDED','FAILED','SKIPPED')");
  expect(journal).toContain("locked_until > now()");
 });
 it("worker is opt-in and re-reads the lease before internal attention, never automatically messages customers",()=>{
  expect(worker).toContain('SERVICEDESK_AUTO_INTERNAL_QUOTE_ACCEPTED === "true"');
  expect(worker).toContain("NO_DEPLOYMENT_OPT_IN");
  expect(worker).toContain("servicedesk_claim_quote_source_events");
  expect(worker).toContain("servicedesk_complete_quote_source_event");
  expect(worker).toContain('from("workflow_source_events")');
  expect(worker).toContain("QUOTE_SOURCE_LEASE_REVALIDATION_FAILED");
  expect(worker).toContain("providerMessagesSent: 0");
  expect(bridge).toContain("APPROVAL_REQUIRED");
  expect(bridge).toContain("best effort, not a transactional outbox");
 });
 it("unit evidence and SQL source still require independent installed-schema and owner staging receipts",()=>{
  const harness=read("tests/db/v4-quote-accepted-source-recovery.test.ts");
  const migrationTest=read("tests/db/v4-default-branch-security-migration.test.ts");
  expect(harness).toContain("is honest about claim, transient crash and completion failure");
  expect(harness).toContain("never claims events while the server kill switch is disabled");
  expect(migrationTest).toContain("0065_v4_default_branch_membership_authority.sql");
  expect(journal).toContain("Requires authorized staging migration and tenant UAT");
 });
});
