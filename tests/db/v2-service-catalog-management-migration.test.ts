import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/0020_v2_service_catalog_management.sql"),
  "utf8",
);

describe("V2 service catalog management migration", () => {
  it("keeps the owner command service-role-only and workspace-scoped", () => {
    expect(sql).toContain("servicedesk_update_service_catalog_item");
    expect(sql).toContain("v_actor_role <> 'OWNER'");
    expect(sql).toContain("m.role = 'OWNER'");
    expect(sql).toContain("m.status = 'ACTIVE'");
    expect(sql).toContain("where workspace_id = v_workspace");
    expect(sql).toContain("revoke all on function public.servicedesk_update_service_catalog_item(jsonb) from authenticated");
    expect(sql).toContain("grant execute on function public.servicedesk_update_service_catalog_item(jsonb) to service_role");
  });

  it("protects stale writes, idempotency and audit history", () => {
    expect(sql).toContain("SERVICE_VERSION_CONFLICT");
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("service_catalog.update");
    expect(sql).toContain("insert into public.audit_events");
    expect(sql).toContain("service_catalog.updated");
    expect(sql).toContain("before_data");
    expect(sql).toContain("after_data");
  });
});
