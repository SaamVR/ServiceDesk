import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/0056_v2_workflow_rule_execution.sql"),
  "utf8",
);

describe("V2 workflow execution migration", () => {
  it("separates preview from live execution and caps recursion", () => {
    expect(sql).toContain("mode in ('PREVIEW','LIVE')");
    expect(sql).toContain("recursion_depth integer not null default 0 check (recursion_depth between 0 and 2)");
    expect(sql).toContain("when v_mode = 'PREVIEW' then 'PREVIEWED'");
    expect(sql).toContain("when v_mode = 'PREVIEW' then 'PREVIEW_ONLY'");
    expect(sql).toContain("WORKFLOW_RECURSION_LIMIT");
  });

  it("allows draft preview but requires the current published version for live execution", () => {
    expect(sql).toContain("v_mode = 'LIVE'");
    expect(sql).toContain("v_version.state <> 'PUBLISHED'");
    expect(sql).toContain("v_rule.published_version_number <> v_version.version_number");
    expect(sql).toContain("v_mode = 'PREVIEW'");
    expect(sql).toContain("v_version.state not in ('DRAFT','PUBLISHED')");
  });

  it("stores only safe event snapshot fields from the event catalogue", () => {
    expect(sql).toContain("servicedesk_validate_workflow_event_snapshot");
    expect(sql).toContain("servicedesk_workflow_allowed_condition_fields");
    expect(sql).toContain("WORKFLOW_EVENT_FIELD_NOT_ALLOWED");
    expect(sql).toContain("WORKFLOW_EVENT_VALUE_INVALID");
    expect(sql).not.toContain("jsonb_object_length");
  });


  it("requires a persisted preview before draft publish", () => {
    expect(sql).toContain("servicedesk_require_workflow_preview_before_publish");
    expect(sql).toContain("workflow_rule_versions_require_preview");
    expect(sql).toContain("old.state = 'DRAFT' and new.state = 'PUBLISHED'");
    expect(sql).toContain("e.mode = 'PREVIEW'");
    expect(sql).toContain("e.state = 'PREVIEWED'");
    expect(sql).toContain("workflow draft must be previewed before publish");
  });

  it("provides an owner-only synthetic preview RPC that records preview decisions without running actions", () => {
    const start = sql.indexOf("servicedesk_preview_workflow_rule_version");
    const end = sql.indexOf("servicedesk_approve_workflow_external_action", start);
    const preview = sql.slice(start, end);
    expect(preview).toContain("v_role <> 'OWNER'");
    expect(preview).toContain("servicedesk_actor_is_workspace_owner");
    expect(preview).toContain("servicedesk_validate_workflow_event_snapshot");
    expect(preview).toContain("'mode', 'PREVIEW'");
    expect(preview).toContain("servicedesk_record_workflow_execution");
    expect(preview).toContain("'previewOnly', true");
    expect(preview).not.toContain("servicedesk_execute_workflow_attention_action");
    expect(preview).not.toContain("insert into public.outbox_events");
  });


  it("requires approval metadata for external terminal action states at the table boundary", () => {
    expect(sql).toContain("state in ('APPROVED','SUCCEEDED','FAILED','SUPPRESSED')");
    expect(sql).toContain("approved_by is not null");
    expect(sql).toContain("approved_at is not null");
    expect(sql).toContain("action_type = 'CREATE_ATTENTION'");
    expect(sql).toContain("state in ('PREVIEW_ONLY','PENDING','SUCCEEDED','FAILED','SUPPRESSED')");
  });

  it("requires explicit owner approval for every external send action", () => {
    expect(sql).toContain("then 'APPROVAL_REQUIRED'");
    expect(sql).toContain("servicedesk_approve_workflow_external_action");
    expect(sql).toContain("v_role <> 'OWNER'");
    expect(sql).toContain("WORKFLOW_EXTERNAL_ACTION_APPROVAL_REQUIRED");
    expect(sql).toContain("WORKFLOW_EXTERNAL_ACTION_APPROVED");
  });

  it("executes only the internal attention catalogue action directly", () => {
    const start = sql.indexOf("servicedesk_execute_workflow_attention_action");
    const end = sql.indexOf("servicedesk_mark_workflow_action_result", start);
    const action = sql.slice(start, end);
    expect(action).toContain("v_action.action_type <> 'CREATE_ATTENTION'");
    expect(action).toContain("insert into public.attention_items");
    expect(action).not.toContain("insert into public.outbox_events");
    expect(action).not.toContain("update public.requests");
    expect(action).not.toContain("update public.quotes");
    expect(action).not.toContain("update public.visits");
    expect(action).not.toContain("update public.invoices");
  });

  it("replays only a failed action and never the source booking/event", () => {
    const start = sql.indexOf("servicedesk_replay_failed_workflow_action");
    const action = sql.slice(start);
    expect(action).toContain("v_action.state <> 'FAILED'");
    expect(action).toContain("WORKFLOW_REPLAY_REQUIRES_FAILED_ACTION");
    expect(action).toContain("v_next > 5");
    expect(action).toContain("'sourceBookingReplayed', false");
    expect(action).not.toContain("update public.requests");
    expect(action).not.toContain("update public.quotes");
    expect(action).not.toContain("update public.visits");
    expect(action).not.toContain("update public.invoices");
  });

  it("keeps action result and replay mutations service-role-only", () => {
    for (const fn of [
      "servicedesk_record_workflow_execution",
      "servicedesk_approve_workflow_external_action",
      "servicedesk_execute_workflow_attention_action",
      "servicedesk_mark_workflow_action_result",
      "servicedesk_replay_failed_workflow_action",
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
