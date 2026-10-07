import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/0053_v2_multibranch_foundation.sql"),
  "utf8",
);

describe("V2 multi-branch foundation", () => {
  it("creates branches inside workspace tenancy and backfills exactly one default branch", () => {
    expect(sql).toContain("create table if not exists public.workspace_branches");
    expect(sql).toContain("workspace_id uuid not null references public.workspaces(id)");
    expect(sql).toContain("workspace_branches_one_default_idx");
    expect(sql).toContain("where is_default");
    expect(sql).toContain("'MAIN'");
    expect(sql).toContain("'Main branch'");
    expect(sql).toContain("where not exists");
  });

  it("keeps owner company-wide while requiring explicit non-owner branch assignment", () => {
    expect(sql).toContain("create table if not exists public.branch_memberships");
    expect(sql).toContain("m.role = 'OWNER'");
    expect(sql).toContain("from public.branch_memberships bm");
    expect(sql).toContain("bm.branch_id = target_branch");
    expect(sql).toContain("bm.active");
  });

  it("backfills branch IDs across property/request/crew/schedule truth", () => {
    for (const table of ["properties", "requests", "crews", "capacity_slots", "visits", "recurrence_rules"]) {
      expect(sql).toContain(`alter table public.${table} add column if not exists branch_id uuid`);
      expect(sql).toContain(`alter table public.${table} alter column branch_id set not null`);
    }
    expect(sql).toContain("requests_property_same_branch_fk");
    expect(sql).toContain("capacity_slots_crew_same_branch_fk");
    expect(sql).toContain("visits_request_same_branch_fk");
    expect(sql).toContain("visits_crew_same_branch_fk");
    expect(sql).toContain("recurrence_property_same_branch_fk");
  });

  it("replaces broad dispatcher policies with branch-aware operational policies", () => {
    expect(sql).toContain("drop policy if exists properties_staff_all");
    expect(sql).toContain("properties_branch_staff_all");
    expect(sql).toContain("requests_branch_staff_all");
    expect(sql).toContain("crews_branch_staff_all");
    expect(sql).toContain("visits_branch_staff_all");
    expect(sql).toContain("quotes_branch_staff_all");
    expect(sql).toContain("invoices_branch_staff_read");
    expect(sql).toContain("visit_evidence_branch_staff_select");
    expect(sql).toContain("visit_checklist_branch_staff_select");
    expect(sql).toContain("public.has_branch_access");
  });

  it("does not weaken customer-scoped policies or workspace tenant keys", () => {
    expect(sql).not.toContain("drop policy if exists properties_customer_select");
    expect(sql).not.toContain("drop policy if exists requests_customer_select");
    expect(sql).not.toContain("drop policy if exists quotes_customer_select");
    expect(sql).not.toContain("drop policy if exists invoices_customer_read");
    expect(sql).not.toMatch(/drop column\s+workspace_id/i);
  });

  it("creates default branches for future workspaces", () => {
    expect(sql).toContain("servicedesk_seed_default_branch");
    expect(sql).toContain("after insert on public.workspaces");
    expect(sql).toContain("for each row execute function public.servicedesk_seed_default_branch()");
  });
});
