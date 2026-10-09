import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/0058_v2_enterprise_governance.sql"),
  "utf8",
);

describe("V2 enterprise governance migration", () => {
  it("delegates only a fixed dispatcher capability catalogue", () => {
    expect(sql).toContain("SERVICE_CATALOG_MANAGE");
    expect(sql).not.toContain("'WORKFLOW_MANAGE'");
    expect(sql).not.toContain("'RETENTION_MANAGE'");
    expect(sql).not.toContain("'AUDIT_EXPORT'");
    expect(sql).toContain("v_member.role <> 'DISPATCHER'");
    expect(sql).toContain("'SERVICE_CATALOG_MANAGE', v_now");
    expect(sql).toContain("SERVICE_CATALOG_SCOPE_REQUIRED");
  });

  it("keeps audit export owner-only and metadata-only", () => {
    const start = sql.indexOf("servicedesk_read_audit_export_metadata");
    const exportSql = sql.slice(start);
    expect(exportSql).toContain("v_role <> 'OWNER'");
    expect(exportSql).toContain("servicedesk_actor_is_workspace_owner");
    expect(exportSql).toContain("v_to - v_from > interval '31 days'");
    expect(exportSql).toContain("least(coalesce(nullif(p_input->>'limit','')::integer, 1000), 5000)");
    expect(exportSql).toContain("'action', e.action");
    expect(exportSql).toContain("'resourceType', e.resource_type");
    expect(exportSql).not.toContain("'beforeData'");
    expect(exportSql).not.toContain("'afterData'");
    expect(exportSql).toContain("before_data and after_data are intentionally excluded");
  });

  it("supports only read-only, owner-approved tenant support scopes capped at 24 hours", () => {
    expect(sql).toContain("scope in ('READ_DIAGNOSTICS','READ_AUDIT_METADATA')");
    expect(sql).not.toContain("WRITE_");
    expect(sql).not.toContain("IMPERSONATE");
    expect(sql).toContain("expires_at <= approved_at + interval '24 hours'");
    expect(sql).toContain("TENANT_SUPPORT_ACCESS_GRANTED");
    expect(sql).toContain("TENANT_SUPPORT_ACCESS_REVOKED");
  });

  it("stores only a support subject hash, never support email or token", () => {
    expect(sql).toContain("support_subject_hash ~ '^[a-f0-9]{64}$'");
    expect(sql).not.toContain("support_email");
    expect(sql).not.toContain("support_token");
    expect(sql).toContain("supportSubjectHashPrefix");
  });

  it("requires active workspace membership for delegated capabilities", () => {
    expect(sql).toContain("join public.memberships m");
    expect(sql).toContain("m.status = 'ACTIVE'");
    expect(sql).toContain("m.role = 'DISPATCHER'");
    expect(sql).toContain("g.expires_at is null or g.expires_at > p_at");
  });

  it("keeps all governance mutations behind service-role RPCs", () => {
    for (const fn of [
      "servicedesk_set_operator_capability",
      "servicedesk_grant_tenant_support_access",
      "servicedesk_revoke_tenant_support_access",
      "servicedesk_check_tenant_support_access",
      "servicedesk_read_audit_export_metadata",
    ]) {
      expect(sql).toContain(`grant execute on function public.${fn}(jsonb) to service_role`);
    }
  });
});
