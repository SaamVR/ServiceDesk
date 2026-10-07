import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/0053_v2_multibranch_core.sql"),
  "utf8",
);

describe("V2 multi-branch core migration", () => {
  it("creates a branch dimension inside the existing workspace boundary", () => {
    expect(sql).toContain("create table if not exists public.workspace_branches");
    expect(sql).toContain("workspace_id uuid not null references public.workspaces(id)");
    expect(sql).toContain("unique (workspace_id, code)");
    expect(sql).toContain("workspace_branches_one_default_idx");
  });

  it("backfills exactly one MAIN branch for existing workspaces and assigns active staff", () => {
    expect(sql).toContain("select w.id, 'MAIN', w.name, w.timezone, w.currency, true, true");
    expect(sql).toContain("where not exists");
    expect(sql).toContain("insert into public.branch_memberships");
    expect(sql).toContain("where m.status = 'ACTIVE'");
  });

  it("gives owners company-wide branch access while non-owners require an active branch assignment", () => {
    const start = sql.indexOf("create or replace function public.servicedesk_has_branch_access");
    const end = sql.indexOf("revoke all on function public.servicedesk_default_branch", start);
    const helper = sql.slice(start, end);
    expect(helper).toContain("m.role = 'OWNER'");
    expect(helper).toContain("from public.branch_memberships bm");
    expect(helper).toContain("bm.status = 'ACTIVE'");
    expect(helper).toContain("bm.branch_id = target_branch");
  });

  it("backfills branch ids before making operational records non-null", () => {
    for (const table of ["properties", "requests", "conversations", "crews", "capacity_slots", "visits", "recurrence_rules"]) {
      expect(sql).toContain(`alter table public.${table} add column if not exists branch_id uuid`);
      expect(sql).toContain(`alter table public.${table} alter column branch_id set not null`);
    }
    expect(sql.indexOf("update public.properties")).toBeLessThan(sql.indexOf("alter table public.properties alter column branch_id set not null"));
    expect(sql.indexOf("update public.requests")).toBeLessThan(sql.indexOf("alter table public.requests alter column branch_id set not null"));
  });

  it("derives branch defaults for legacy inserts and rejects cross-branch operational links", () => {
    expect(sql).toContain("servicedesk_apply_branch_defaults_and_consistency");
    expect(sql).toContain("REQUEST_PROPERTY_BRANCH_MISMATCH");
    expect(sql).toContain("CONVERSATION_REQUEST_BRANCH_MISMATCH");
    expect(sql).toContain("CAPACITY_CREW_BRANCH_MISMATCH");
    expect(sql).toContain("VISIT_REQUEST_BRANCH_MISMATCH");
    expect(sql).toContain("VISIT_CREW_BRANCH_MISMATCH");
    expect(sql).toContain("VISIT_SLOT_BRANCH_MISMATCH");
    expect(sql).toContain("RECURRENCE_BRANCH_MISMATCH");
  });

  it("replaces legacy workspace-wide staff policies with branch-aware policies", () => {
    for (const policy of [
      "properties_staff_all",
      "requests_staff_all",
      "conversations_staff_all",
      "crews_staff_all",
      "capacity_slots_staff_all",
      "visits_staff_all",
      "recurrence_rules_staff_all",
      "messages_staff_select",
    ]) {
      expect(sql).toContain(`drop policy if exists ${policy}`);
    }
    expect(sql).toContain("servicedesk_has_branch_access(workspace_id, branch_id");
    expect(sql).toContain("public.servicedesk_has_branch_access(c.workspace_id, c.branch_id");
  });

  it("preserves customer self-service policies instead of replacing them with staff branch membership", () => {
    expect(sql).not.toContain("drop policy if exists properties_customer_select");
    expect(sql).not.toContain("drop policy if exists requests_customer_select");
    expect(sql).not.toContain("drop policy if exists conversations_customer_select");
  });
});
