import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = (name: string) =>
  readFileSync(join(process.cwd(), "supabase/migrations", name), "utf8");

const schema = migration("0026_v2_commercial_billing_schema.sql");
const helpers = migration("0027_v2_commercial_billing_helpers.sql");
const draft = migration("0028_v2_commercial_billing_draft_command.sql");
const finalize = migration("0029_v2_commercial_billing_finalize.sql");
const sql = [schema, helpers, draft, finalize].join("\n");

describe("V2 commercial consolidated billing migrations", () => {
  it("creates traceable draft and line authority without a parallel payment ledger", () => {
    expect(schema).toContain("create table if not exists public.commercial_billing_drafts");
    expect(schema).toContain("create table if not exists public.commercial_billing_lines");
    expect(schema).toContain("source_type in ('VISIT','ADJUSTMENT')");
    expect(schema).toContain("references public.visits(workspace_id, id)");
    expect(schema).toContain("references public.commercial_exception_cases(workspace_id, id)");
    expect(sql).not.toContain("insert into public.ledger_entries");
    expect(sql).not.toContain("insert into public.verified_payment_applications");
    expect(sql).not.toContain("payment_method");
  });

  it("extends authoritative invoices for exactly one quote or commercial billing source", () => {
    expect(schema).toContain("alter column quote_id drop not null");
    expect(schema).toContain("commercial_billing_draft_id uuid");
    expect(schema).toContain("invoices_business_source_ck");
    expect(schema).toContain("(quote_id is not null) <> (commercial_billing_draft_id is not null)");
    expect(schema).toContain("invoices_commercial_billing_draft_uq");
  });

  it("binds candidate visits to the contract site/property/service lineage", () => {
    expect(helpers).toContain("servicedesk_commercial_billing_candidates");
    expect(helpers).toContain("rr.property_id = site.property_id");
    expect(helpers).toContain("req.property_id = site.property_id and req.service_id = cs.service_id");
    expect(helpers).toContain("v.status = 'COMPLETED'");
    expect(helpers).toContain("(v.starts_at at time zone sp.timezone)::date between p_period_start and p_period_end");
  });

  it("requires resolved quality/exception review and an explicit fixed-per-visit rate", () => {
    expect(helpers).toContain("qc.state in ('OPEN','IN_REVIEW')");
    expect(helpers).toContain("ec.state in ('OPEN','IN_REVIEW')");
    expect(helpers).toContain("'FIXED_PER_VISIT'");
    expect(helpers).toContain("rate_resolved");
    expect(draft).toContain("COMMERCIAL_BILLING_RATE_UNRESOLVED");
    expect(draft).toContain("COMMERCIAL_BILLING_NO_ELIGIBLE_VISITS");
  });

  it("prevents duplicate visit inclusion and supports correction before issue", () => {
    expect(schema).toContain("commercial_billing_active_visit_uq");
    expect(schema).toContain("where visit_id is not null and state = 'INCLUDED'");
    expect(finalize).toContain("servicedesk_set_commercial_billing_line_state");
    expect(finalize).toContain("COMMERCIAL_BILLING_VERSION_CONFLICT");
    expect(finalize).toContain("COMMERCIAL_BILLING_VISIT_ALREADY_INCLUDED");
    expect(draft).toContain("COMMERCIAL_BILLING_VISIT_ALREADY_INCLUDED");
  });

  it("revalidates feature, contract and totals before creating an issued invoice", () => {
    expect(draft).toContain("COMMERCIAL_FEATURE_DISABLED");
    expect(finalize).toContain("COMMERCIAL_FEATURE_DISABLED");
    expect(finalize).toContain("COMMERCIAL_BILLING_CONTRACT_NO_LONGER_ISSUABLE");
    expect(finalize).toContain("COMMERCIAL_BILLING_EMPTY_DRAFT");
    expect(finalize).toContain("COMMERCIAL_BILLING_NONPOSITIVE_TOTAL");
    expect(finalize).toContain("'ISSUED', v_draft.currency, v_draft.net_total_minor, 0, 0, v_draft.net_total_minor");
    expect(sql).not.toContain("stripe");
  });

  it("keeps mutations service-role-only", () => {
    for (const fn of [
      "servicedesk_create_commercial_billing_draft",
      "servicedesk_set_commercial_billing_line_state",
      "servicedesk_finalize_commercial_billing_draft",
    ]) {
      expect(sql).toContain(`revoke all on function public.${fn}(jsonb) from public, anon, authenticated;`);
      expect(sql).toContain(`grant execute on function public.${fn}(jsonb) to service_role;`);
    }
  });
});
