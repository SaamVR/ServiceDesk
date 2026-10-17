import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
const sql=readFileSync(join(process.cwd(),
  "scripts/release/v4-merchant-exact-quote-chain-readonly.sql"),"utf8");

describe("R29 exact saved request to invoice to quote-source attention readback",()=>{
  it("is read-only and discloses aggregate counts, not customer or tenant records",()=>{
    expect(sql).toContain("BEGIN TRANSACTION READ ONLY;");
    expect(sql).toContain("COMMIT;");
    expect(sql).not.toMatch(/\b(?:insert\s+into|update\s+public\.|delete\s+from|drop\s+table|alter\s+table|create\s+table)\b/i);
    expect(sql).toContain("SELECT jsonb_pretty(jsonb_build_object(");
    expect(sql).not.toContain("SELECT *");
    expect(sql).toContain("'actualOwnerSessionAcceptance','NOT_PROVEN'");
    expect(sql).toContain("'crossTenantSignedInIsolation','NOT_PROVEN'");
  });
  it("does not count unrelated request/quote/invoice rows as a commercial record chain",()=>{
    for(const a of ["q.request_id = r.id","q.workspace_id = r.workspace_id",
      "i.quote_id = q.id","i.workspace_id = q.workspace_id",
      "i.total_minor = q.total_minor","trim(i.currency) = trim(q.currency)",
      "q.status = 'ACCEPTED'","q.accepted_at IS NOT NULL",
      "q.superseded_by IS NULL","sq.workspace_id","sq.branch_id"])
      expect(sql).toContain(a);
  });
  it("matches the immutable source key instead of counting any QUOTE_ACCEPTED execution",()=>{
    for(const a of ["e.execution_key =","e.rule_version_id::text",
      "extensions.digest(concat_ws('|'", "sq.quote_id::text, '0', ''",
      "e.mode = 'LIVE'","e.event_type = 'QUOTE_ACCEPTED'",
      "e.matched = true","e.recursion_depth = 0",
      "v.id = e.rule_version_id","v.branch_id = e.branch_id"])
      expect(sql).toContain(a);
    expect(sql).not.toContain("e.event_snapshot->>'quoteId'");
  });
  it("requires a matched persisted SUCCEEDED action and its exact attention resource",()=>{
    for(const a of ["a.execution_id = m.execution_id",
      "a.action_type = 'CREATE_ATTENTION'","a.state = 'SUCCEEDED'",
      "attention.workspace_id = a.workspace_id",
      "attention.resource_id = m.execution_id",
      "attention.resource_type = 'workflow_execution'",
      "attention.type = 'WORKFLOW_RULE'"])
      expect(sql).toContain(a);
    expect(sql).toContain("'providerDeliveryAndPaymentSettlement','NOT_PROVEN'");
  });
});
