import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";
import {createQuoteSnapshot,defaultRateCard,type QuoteSnapshot} from "../../src/domain/quote";
import {createQuoteDraftWithRepository} from "../../src/server/core/quotes";

const read=(file:string)=>readFileSync(file,"utf8");

// Inspect SQL commands, not data literals: the read-only catalog probe
// intentionally searches pg_indexes for the string "CREATE UNIQUE INDEX".
// Removing string literals and comments keeps executable DDL/DML visible.
const executableSql=(sql:string)=>sql
 .replace(/'(?:''|[^'])*'/g,"''")
 .replace(/--[^\r\n]*/g,"")
 .replace(/\/\*[\s\S]*?\*\//g," ");

const forbiddenWrites=/\b(?:insert\s+into|update\s+public|delete\s+from|alter\s+table|create\s+(?:unique\s+)?index|drop\s+table)\b/i;

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
 it("reproduces a legacy split-write failure without pretending it was a database transaction",async()=>{
  const now="2026-10-04T06:00:00.000Z";
  const prior=createQuoteSnapshot({
   id:"quote-existing",workspaceId:"fictional-workspace",requestId:"fictional-request",
   serviceCode:"STANDARD",bedrooms:1,bathrooms:1,now,
  },defaultRateCard);
  let priorSavedStatus:QuoteSnapshot["status"]="APPROVED";
  let successorSaved=false;
  const repo={
   nextQuoteId:()=>"quote-successor",
   findById:async()=>undefined,
   findLatestByRequest:async()=>({...prior,status:priorSavedStatus}),
   supersedeQuote:async(id:string)=>{
    expect(id).toBe("quote-existing");
    priorSavedStatus="SUPERSEDED";
   },
   saveQuote:async()=>{
    // Simulate the SECOND independent repository operation failing.
    successorSaved=false;
    throw new Error("FICTIONAL_SUCCESSOR_INSERT_FAILED");
   },
   updateQuoteStatus:async()=>undefined,
  };
  await expect(createQuoteDraftWithRepository(repo,{
   workspaceId:"fictional-workspace",requestId:"fictional-request",
   serviceCode:"STANDARD",bedrooms:2,bathrooms:1,now,
  })).rejects.toThrow("FICTIONAL_SUCCESSOR_INSERT_FAILED");
  expect(priorSavedStatus).toBe("SUPERSEDED");
  expect(successorSaved).toBe(false);
  // This intentionally demonstrates the unrolled-back OLD quote state of
  // the legacy interface. NO real DB mutated; this is a RELEASE VETO witness.
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
  expect(review).toContain("existing duplicates");
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
  expect(executableSql(sql)).not.toMatch(forbiddenWrites);
 });
 it("recognizes catalog index-definition text as data but still rejects executable writes",()=>{
  const sql=read("scripts/release/v4-f23-current-quote-readonly-preflight.sql");
  expect(sql).toContain("indexdef ilike '%CREATE UNIQUE INDEX%'");
  expect(executableSql(sql)).not.toMatch(forbiddenWrites);
  const withRealWrite=sql.replace("commit;","update public.quotes set status='SUPERSEDED';\ncommit;");
  expect(executableSql(withRealWrite)).toMatch(forbiddenWrites);
  const withRealDdl=sql.replace("commit;","create unique index forbidden_idx on public.quotes(id);\ncommit;");
  expect(executableSql(withRealDdl)).toMatch(forbiddenWrites);
 });
});
