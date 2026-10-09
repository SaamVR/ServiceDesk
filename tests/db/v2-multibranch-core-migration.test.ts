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

  it("provides owner branch-management commands without making owner access assignment-dependent", () => {
    expect(sql).toContain("servicedesk_upsert_workspace_branch");
    expect(sql).toContain("servicedesk_set_branch_membership");
    expect(sql).toContain("v_role <> 'OWNER'");
    expect(sql).toContain("DEFAULT_BRANCH_REQUIRED");
    expect(sql).toContain("OWNER_BRANCH_ASSIGNMENT_NOT_REQUIRED");
    expect(sql).toContain("STAFF_MEMBERSHIP_NOT_FOUND");
    expect(sql).toContain("grant execute on function public.servicedesk_upsert_workspace_branch(jsonb) to service_role");
    expect(sql).toContain("grant execute on function public.servicedesk_set_branch_membership(jsonb) to service_role");
  });

  it("never permits branch assignment to create or widen workspace membership", () => {
    const start = sql.indexOf("create or replace function public.servicedesk_set_branch_membership");
    const end = sql.indexOf("revoke all on function public.servicedesk_upsert_workspace_branch", start);
    const command = sql.slice(start, end);
    expect(command).toContain("from public.memberships");
    expect(command).toContain("status = 'ACTIVE'");
    expect(command).not.toContain("insert into public.memberships");
    expect(command).not.toContain("update public.memberships");
  });


  it("uses actor-aware authorization for service-role RPCs instead of auth.uid()", () => {
    expect(sql).toContain("servicedesk_actor_is_workspace_owner");
    expect(sql).toContain("servicedesk_actor_has_branch_access");
    expect(sql).toContain("m.user_id = actor_user");
    expect(sql).toContain("m.role::text = actor_role");
    expect(sql).toContain("grant execute on function public.servicedesk_actor_has_branch_access");
    const managementStart = sql.indexOf("create or replace function public.servicedesk_upsert_workspace_branch");
    const managementEnd = sql.indexOf("alter table public.workspace_branches enable row level security", managementStart);
    const management = sql.slice(managementStart, managementEnd);
    expect(management).toContain("servicedesk_actor_is_workspace_owner");
    expect(management).not.toContain("has_active_membership");
  });


  it("rejects malformed single-dollar SQL function delimiters", () => {
    expect(sql.split("\n").some((line) => line.trim() === "as $")).toBe(false);
    expect(sql.split("\n").some((line) => line.trim() === "$;")).toBe(false);
  });

});
