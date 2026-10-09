import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/0057_v2_vertical_pack_framework.sql"),
  "utf8",
);

describe("V2 vertical pack framework", () => {
  it("stores versioned schemas and adapter keys separately from shared core authority", () => {
    expect(sql).toContain("create table if not exists public.vertical_pack_versions");
    expect(sql).toContain("service_schema jsonb not null");
    expect(sql).toContain("intake_schema jsonb not null");
    expect(sql).toContain("checklist_template jsonb not null");
    expect(sql).toContain("duration_adapter_key text not null");
    expect(sql).toContain("pricing_adapter_key text not null");
    expect(sql).toContain("policy_schema jsonb not null");
    expect(sql).not.toMatch(/alter table public\.invoices .*vertical/i);
    expect(sql).not.toMatch(/alter table public\.ledger_entries .*vertical/i);
  });

  it("keeps cleaning as the only seeded supported vertical", () => {
    expect(sql).toContain("'CLEANING'");
    expect(sql).toContain("'BASELINE_EXISTING'");
    expect(sql).not.toContain("'MOBILE_DETAILING'");
    expect(sql).not.toContain("'PROPERTY_MAINTENANCE'");
  });

  it("blocks release and activation of another vertical without verified buyer evidence", () => {
    expect(sql).toContain("or state <> 'RELEASED'");
    expect(sql).toContain("or evidence_status = 'BUYER_EVIDENCE_VERIFIED'");
    expect(sql).toContain("VERTICAL_PACK_BUYER_EVIDENCE_REQUIRED");
  });

  it("backfills existing workspaces and services to the cleaning baseline", () => {
    expect(sql).toContain("select w.id, 'CLEANING', 1, 'ENABLED'");
    expect(sql).toContain("select s.workspace_id, s.id, 'CLEANING', 1");
    expect(sql).toContain("on conflict (workspace_id, service_id) do nothing");
  });

  it("uses workspace-scoped bindings and RLS without widening tenant authority", () => {
    expect(sql).toContain("references public.workspace_vertical_packs(workspace_id, pack_code, version_number)");
    expect(sql).toContain("using (public.has_active_membership(workspace_id))");
    expect(sql).toContain("exists (");
    expect(sql).toContain("m.user_id = auth.uid()");
  });

  it("keeps activation owner-only and audited", () => {
    expect(sql).toContain("v_role <> 'OWNER'");
    expect(sql).toContain("servicedesk_actor_is_workspace_owner");
    expect(sql).toContain("VERTICAL_PACK_ENABLED");
    expect(sql).toContain("grant execute on function public.servicedesk_enable_vertical_pack(jsonb) to service_role");
  });

  it("keeps every service binding on the workspace-enabled pack version", () => {
    expect(sql).toContain("unique (workspace_id, pack_code, version_number)");
    expect(sql).toContain("foreign key (workspace_id, pack_code, version_number)");
    expect(sql).toContain("references public.workspace_vertical_packs(workspace_id, pack_code, version_number)");
    expect(sql).toContain("on update cascade on delete restrict");
  });

});
