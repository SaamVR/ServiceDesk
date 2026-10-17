import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql=readFileSync(join(process.cwd(),
  "scripts/release/v4-merchant-coherence-readonly.sql"),"utf8");

describe("R16 read-only merchant same-workspace prerequisite evidence",()=>{
 it("has a genuinely read-only transaction and does not emit tenant identifiers",()=>{
  expect(sql).toContain("BEGIN TRANSACTION READ ONLY;");
  expect(sql).toContain("COMMIT;");
  expect(sql).not.toMatch(/\b(?:INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM|DROP\s+TABLE|ALTER\s+TABLE|CREATE\s+TABLE)\b/i);
  expect(sql).not.toMatch(/'\s*(?:workspaceId|userId|email|phone|apiKey|accessToken|priceAmount)\s*'/i);
 });
 it("requires owner, active USD branch, same-workspace service trio and linked pricing",()=>{
  for(const needle of ["m.role = 'OWNER'","m.status = 'ACTIVE'",
    "count(DISTINCT sc.code)","sc.workspace_id = w.id",
    "('STANDARD','DEEP','MOVE_OUT')","pb.workspace_id = w.id",
    "b.currency = 'USD'","rc.workspace_id = pb.workspace_id",
    "sameWorkspacePricingCandidateCount"])
   expect(sql).toContain(needle);
 });
 it("does not upgrade unrelated aggregates to quote/attention/invoice or provider acceptance",()=>{
  for(const needle of ["has_saved_request AND has_saved_quote",
    "has_workflow_execution AND has_attention AND has_saved_invoice",
    "NOT_PROVEN_BY_AGGREGATES_OR_INDEPENDENT_RECORD_PRESENCE",
    "NOT_PROVEN_BY_AGGREGATES","INDEPENDENT_ACTIVE_OWNERS_REQUIRED"])
   expect(sql).toContain(needle);
 });
});
