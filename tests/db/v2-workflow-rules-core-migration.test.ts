import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/0055_v2_workflow_rules_core.sql"),
  "utf8",
);

describe("V2 workflow rule core migration", () => {
  it("keeps rules branch-scoped inside the existing workspace tenant", () => {
    expect(sql).toContain("create table if not exists public.workflow_rules");
    expect(sql).toContain("branch_id uuid not null");
    expect(sql).toContain("references public.workspace_branches(workspace_id, id)");
    expect(sql).toContain("servicedesk_has_branch_access");
    expect(sql).toContain("servicedesk_actor_has_branch_access");
  });

  it("uses a fixed event and action catalogue with bounded conditions/actions", () => {
    for (const event of [
      "REQUEST_CREATED",
      "QUOTE_ACCEPTED",
      "VISIT_COMPLETED",
      "INVOICE_PAID",
      "ATTENTION_OPENED",
    ]) expect(sql).toContain(event);

    for (const action of [
      "CREATE_ATTENTION",
      "SEND_EMAIL_TEMPLATE",
      "SEND_WHATSAPP_TEMPLATE",
    ]) expect(sql).toContain(action);

    expect(sql).toContain("jsonb_array_length(p_conditions) > 8");
    expect(sql).toContain("jsonb_array_length(p_actions) > p_max_actions");
    expect(sql).toContain("p_max_actions < 1 or p_max_actions > 5");
    expect(sql).toContain("v_operator not in ('EQ','NEQ','IN')");
  });

  it("rejects arbitrary URLs, SQL, secrets and extra action fields", () => {
    expect(sql).toContain("WORKFLOW_UNSAFE_ACTION_MATERIAL");
    expect(sql).toContain("WORKFLOW_ACTION_EXTRA_FIELD");
    expect(sql).toContain("WORKFLOW_ACTION_CATALOGUE_VIOLATION");
    expect(sql).toContain("https?://");
    expect(sql).toContain("api[_-]?key");
    expect(sql).toContain("secret");
    expect(sql).toContain("token");
  });


  it("aliases JSON object keys explicitly before rejecting unknown fields", () => {
    expect(sql).toContain("jsonb_object_keys(v_condition) as condition_keys(key)");
    expect(sql).toContain("jsonb_object_keys(v_action) as action_keys(key)");
    expect(sql).toContain("key not in ('field','operator','value')");
  });

  it("makes published definitions immutable and rollback creates a new published version", () => {
    expect(sql).toContain("servicedesk_prevent_published_workflow_version_mutation");
    expect(sql).toContain("published workflow versions are immutable");
    expect(sql).toContain("servicedesk_rollback_workflow_rule");
    expect(sql).toContain("based_on_version_number");
    expect(sql).toContain("v_source.version_number");
    expect(sql).toContain("v_next, 'PUBLISHED'");
  });

  it("requires owner authority for draft/publish/rollback and records publish/rollback audits", () => {
    expect(sql).toContain("v_role <> 'OWNER'");
    expect(sql).toContain("servicedesk_actor_is_workspace_owner");
    expect(sql).toContain("WORKFLOW_RULE_VERSION_PUBLISHED");
    expect(sql).toContain("WORKFLOW_RULE_ROLLED_BACK");
  });

  it("keeps mutations service-role-only and direct authenticated access read-only", () => {
    expect(sql).toContain("grant select on table public.workflow_rules to authenticated");
    expect(sql).toContain("grant select on table public.workflow_rule_versions to authenticated");
    expect(sql).toContain("grant select, insert, update, delete on table public.workflow_rules to service_role");
    expect(sql).toContain("grant select, insert, update, delete on table public.workflow_rule_versions to service_role");
    for (const fn of [
      "servicedesk_save_workflow_rule_draft",
      "servicedesk_publish_workflow_rule_version",
      "servicedesk_rollback_workflow_rule",
    ]) {
      expect(sql).toContain(`revoke all on function public.${fn}(jsonb) from public, anon, authenticated`);
      expect(sql).toContain(`grant execute on function public.${fn}(jsonb) to service_role`);
    }
  });

  it("uses valid PostgreSQL dollar quoting", () => {
    expect(sql.split("\n").some((line) => line.trim() === "as $")).toBe(false);
    expect(sql.split("\n").some((line) => line.trim() === "$;")).toBe(false);
  });
});
