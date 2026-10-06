import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/0026_v2_commercial_consolidated_billing.sql"),
  "utf8",
);

describe("V2 commercial consolidated billing migration", () => {
  it("creates traceable draft and line authority without a parallel invoice ledger", () => {
    expect(sql).toContain("create table if not exists public.commercial_billing_drafts");
    expect(sql).toContain("create table if not exists public.commercial_billing_lines");
    expect(sql).toContain("source_type in ('VISIT','ADJUSTMENT')");
    expect(sql).toContain("references public.visits(workspace_id, id)");
    expect(sql).toContain("references public.commercial_exception_cases(workspace_id, id)");
    expect(sql).not.toContain("insert into public.ledger_entries");
    expect(sql).not.toContain("insert into public.verified_payment_applications");
  });

  it("extends authoritative invoices for exactly one quote or commercial source", () => {
    expect(sql).toContain("alter column quote_id drop not null");
    expect(sql).toContain("commercial_billing_draft_id uuid");
    expect(sql).toContain("invoices_business_source_ck");
    expect(sql).toContain("(quote_id is not null) <> (commercial_billing_draft_id is not null)");
    expect(sql).toContain("invoices_commercial_billing_draft_uq");
  });

  it("derives only completed contract-backed visits and fails closed on unresolved pricing", () => {
    expect(sql).toContain("join public.recurrence_occurrences ro");
    expect(sql).toContain("join public.visits v");
    expect(sql).toContain("v.status = 'COMPLETED'");
    expect(sql).toContain("(v.starts_at at time zone sp.timezone)::date");
    expect(sql).toContain("'FIXED_PER_VISIT'");
    expect(sql).toContain("COMMERCIAL_BILLING_RATE_UNRESOLVED");
    expect(sql).toContain("COMMERCIAL_BILLING_NO_ELIGIBLE_VISITS");
  });

  it("prevents duplicate visit inclusion and supports correction before issue", () => {
    expect(sql).toContain("commercial_billing_active_visit_uq");
    expect(sql).toContain("where visit_id is not null and state = 'INCLUDED'");
    expect(sql).toContain("servicedesk_set_commercial_billing_line_state");
    expect(sql).toContain("COMMERCIAL_BILLING_VERSION_CONFLICT");
    expect(sql).toContain("COMMERCIAL_BILLING_VISIT_ALREADY_INCLUDED");
  });

  it("revalidates feature, contract and totals before creating an issued invoice", () => {
    expect(sql.match(/COMMERCIAL_FEATURE_DISABLED/g)?.length).toBeGreaterThanOrEqual(3);
    expect(sql).toContain("COMMERCIAL_BILLING_CONTRACT_NO_LONGER_ISSUABLE");
    expect(sql).toContain("COMMERCIAL_BILLING_EMPTY_DRAFT");
    expect(sql).toContain("COMMERCIAL_BILLING_NONPOSITIVE_TOTAL");
    expect(sql).toContain("'ISSUED', v_draft.currency, v_draft.net_total_minor, 0, 0, v_draft.net_total_minor");
    expect(sql).not.toContain("stripe");
    expect(sql).not.toContain("payment_method");
  });

  it("keeps commercial billing mutations behind service-role RPCs", () => {
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
