import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";

const read=(file:string)=>readFileSync(file,"utf8");

describe("F23 independent DBA critic: current quote uniqueness must be proven, not assumed",()=>{
 it("pins the historical single-version constraint, not a single-current-row guarantee",()=>{
  const sql=read("supabase/migrations/0002_quotes.sql");
  expect(sql).toContain("create type public.quote_status as enum");
  for(const state of ["DRAFT","PENDING_APPROVAL","APPROVED","SENT",
    "ACCEPTED","DECLINED","EXPIRED","SUPERSEDED"])
    expect(sql).toContain("'"+state+"'");
  expect(sql).toContain("unique (workspace_id, request_id, version)");
  expect(sql).toContain("create index quotes_request_idx");
  // This historical source is evidence ONLY of its migration contents.
  // It does not prove which indexes are actually installed in Supabase.
  expect(sql).not.toMatch(/create\s+unique\s+index[^;]*status\s*<>\s*'SUPERSEDED'/i);
 });
 it("flags the legacy repository quote-revision write split as transactionally unverified",()=>{
  const source=read("src/server/core/quotes.ts");
  const first=source.indexOf("const previous = await repository.findLatestByRequest(input.requestId);");
  const supersede=source.indexOf("if (previous) await repository.supersedeQuote(previous.id);");
  const save=source.indexOf("await repository.saveQuote(versionedQuote);");
  expect(first).toBeGreaterThanOrEqual(0);
  expect(supersede).toBeGreaterThan(first);
  expect(save).toBeGreaterThan(supersede);
  // Distinct awaits are not an atomic PostgreSQL transaction guarantee;
  // the QuoteRepository interface has no transaction-scope contract.
  const contract=source.slice(source.indexOf("export interface QuoteRepository"),
    source.indexOf("export interface CreateQuoteDraftCommandInput"));
  expect(contract).toContain("supersedeQuote(");
  expect(contract).toContain("saveQuote(");
  expect(contract).not.toContain("transaction(");
  const gateway=read("src/server/core/quote-repository.ts");
  expect(gateway).toContain("async supersedeQuote(");
  expect(gateway).toContain("async saveQuote(");
 });
 it("preserves the F23 sibling-insert veto and keeps proposed index out of migrations",()=>{
  const candidate=read("docs/engineering/security/f23-atomic-hold-release-rpc-candidate.sql");
  const witness=read("scripts/release/v4-f23-pg17-sibling-quote-phantom-witness.sh");
  const prototype=read("scripts/release/v4-f23-pg17-unique-current-quote-remedy-prototype.sh");
  const review=read("docs/engineering/security/f23-quote-phantom-dba-veto-and-review-options-20261107.md");
  expect(candidate).toContain("select count(*) into v_current_count from public.quotes q");
  expect(candidate).toContain("for share");
  expect(witness).toContain("F23_KNOWN_UNSAFE_SIBLING_QUOTE_PHANTOM_REPRODUCED_RELEASE_VETO");
  expect(prototype).toContain("create unique index sd_f23_review_only_one_current_quote");
  expect(review).toContain("REVIEW ONLY");
  expect(review).toContain("existing quotes");
  expect(review).toContain("super");
  expect(read("src/server/workflows/owner-verified-quote-hold-release.ts"))
   .toContain('SERVICEDESK_F23_ATOMIC_RELEASE_APPROVED');
 });
 it("enforces a read-only privacy-preserving DBA preflight",()=>{
  const sql=read("scripts/release/v4-f23-current-quote-readonly-preflight.sql");
  expect(sql).toContain("begin transaction isolation level repeatable read read only;");
  expect(sql).toContain("commit;");
  expect(sql).toContain("group by workspace_id,request_id");
  expect(sql).toContain("requestGroupsWithTwoOrMoreNonSupersededQuotes");
  expect(sql).toContain("'identifiersReturned',false");
  expect(sql).toContain("'safeToEnableF23',false");
  expect(sql).toContain("'allQuoteWritersAudited',false");
  expect(sql).not.toMatch(/^(?!\s*--).*\b(?:insert\s+into|update\s+public|delete\s+from|alter\s+table|create\s+(?:unique\s+)?index|drop\s+table)\b/im);
 });
});
