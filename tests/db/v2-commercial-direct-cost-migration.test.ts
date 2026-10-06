import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (name: string) =>
  readFileSync(join(process.cwd(), "supabase/migrations", name), "utf8");

const schema = source("0036_v2_commercial_direct_cost_schema.sql");
const command = source("0037_v2_commercial_direct_cost_command.sql");
const read = source("0038_v2_commercial_direct_cost_read.sql");

describe("V2 commercial direct cost migrations", () => {
  it("stores append-only labor, supplies and travel with estimate/actual provenance", () => {
    expect(schema).toContain("create table if not exists public.commercial_direct_cost_entries");
    expect(schema).toContain("category in ('LABOR','SUPPLIES','TRAVEL')");
    expect(schema).toContain("basis in ('ESTIMATED','ACTUAL')");
    expect(schema).toContain("direction in ('COST','REVERSAL')");
    expect(schema).toContain("source_kind in ('MANUAL','CREW_RATE','SUPPLY','TRAVEL')");
    expect(schema).not.toMatch(/tax_rate|tax_code|tax_percent/i);
  });

  it("uses reversals instead of destructive cost edits", () => {
    expect(schema).toContain("reverses_entry_id");
    expect(command).toContain("COMMERCIAL_DIRECT_COST_OVER_REVERSAL");
    expect(command).toContain("COMMERCIAL_DIRECT_COST_REVERSAL_MISMATCH");
    expect(command).toContain("COMMERCIAL_DIRECT_COST_REVERSAL_TIME_INVALID");
    expect(command).not.toMatch(/delete\s+from\s+public\.commercial_direct_cost_entries/i);
  });

  it("derives commercial lineage from the authoritative visit/request/recurrence graph", () => {
    expect(command).toContain("join public.requests req");
    expect(command).toContain("join public.recurrence_occurrences ro");
    expect(command).toContain("join public.commercial_site_service_plans sp");
    expect(command).toContain("join public.commercial_contract_sites cs");
    expect(command).toContain("join public.commercial_sites site");
    expect(command).toContain("join public.commercial_contract_versions cv");
    expect(command).toContain("COMMERCIAL_DIRECT_COST_VISIT_NOT_CONTRACT_BACKED");
  });

  it("requires completion for actual costs and contract currency agreement", () => {
    expect(command).toContain("v_basis = 'ACTUAL' and v_visit.status <> 'COMPLETED'");
    expect(command).toContain("COMMERCIAL_DIRECT_COST_ACTUAL_REQUIRES_COMPLETION");
    expect(command).toContain("COMMERCIAL_DIRECT_COST_CURRENCY_MISMATCH");
  });

  it("keeps source categories compatible and idempotent", () => {
    expect(command).toContain("COMMERCIAL_DIRECT_COST_SOURCE_MISMATCH");
    expect(command).toContain("COMMERCIAL_DIRECT_COST_IDEMPOTENCY_CONFLICT");
    expect(command).toContain("idempotency_key = v_idempotency");
  });

  it("reads net cost totals by currency, category and basis", () => {
    expect(read).toContain("sum(case when direction = 'COST' then amount_minor else -amount_minor end)");
    expect(read).toContain("group by currency, category, basis");
    expect(read).toContain("'totals'");
    expect(read).toContain("'entries'");
  });

  it("keeps mutation and reads behind staff/service-role boundaries", () => {
    expect(command).toContain("v_actor_role not in ('OWNER','DISPATCHER')");
    expect(command).toContain("servicedesk_require_staff");
    expect(read).toContain("v_actor_role not in ('OWNER','DISPATCHER')");
    expect(command).toContain("grant execute on function public.servicedesk_record_commercial_direct_cost(jsonb) to service_role");
    expect(read).toContain("grant execute on function public.servicedesk_read_commercial_direct_cost_snapshot(jsonb) to service_role");
  });
});
