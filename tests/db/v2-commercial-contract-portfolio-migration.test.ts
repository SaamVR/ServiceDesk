import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/0024_v2_commercial_contract_portfolio.sql"),
  "utf8",
);

const commercialTables = [
  "workspace_feature_flags",
  "commercial_organizations",
  "commercial_portfolio_contacts",
  "commercial_sites",
  "commercial_contracts",
  "commercial_contract_versions",
  "commercial_contract_sites",
  "commercial_site_service_plans",
  "commercial_exception_cases",
];

describe("V2 commercial contract and portfolio migration", () => {
  it("keeps Wave 2B explicitly feature-gated and disabled by default", () => {
    expect(sql).toContain("create table if not exists public.workspace_feature_flags");
    expect(sql).toContain("enabled boolean not null default false");
    expect(sql).toContain("Absence or enabled=false means the feature is unavailable");
  });

  it("preserves V1 customer and property identity through scoped relationships", () => {
    expect(sql).toContain("references public.customers(workspace_id, id) on delete restrict");
    expect(sql).toContain("references public.properties(workspace_id, id) on delete restrict");
    expect(sql).not.toContain("create table if not exists public.commercial_customers");
    expect(sql).not.toContain("create table if not exists public.commercial_properties");
  });

  it("snapshots versioned contract terms, authority, site scope and availability", () => {
    expect(sql).toContain("create table if not exists public.commercial_contract_versions");
    expect(sql).toContain("version_number integer not null");
    expect(sql).toContain("rate_snapshot jsonb not null");
    expect(sql).toContain("approval_authority jsonb not null");
    expect(sql).toContain("scope_snapshot jsonb not null");
    expect(sql).toContain("service_level_target_minutes integer");
    expect(sql).toContain("availability_snapshot jsonb not null");
    expect(sql).toContain("rate_override_snapshot jsonb");
  });

  it("links site plans to the existing recurrence authority rather than duplicating visit materialization", () => {
    expect(sql).toContain("frequency public.recurrence_frequency not null");
    expect(sql).toContain("recurrence_rule_id uuid");
    expect(sql).toContain("references public.recurrence_rules(workspace_id, id)");
    expect(sql).toContain("Existing recurrence_rules remain the scheduling/materialization authority");
    expect(sql).not.toContain("insert into public.visits");
  });

  it("models auditable commercial exceptions without mutating financial truth", () => {
    expect(sql).toContain("type in ('DENIED_ACCESS','MISSED_VISIT','EXTRA_WORK')");
    expect(sql).toContain("requested_adjustment_kind");
    expect(sql).toContain("requested_adjustment_minor integer");
    expect(sql).toContain("Requested credits or charges do not mutate invoice or ledger truth");
    expect(sql).not.toContain("update public.invoices");
    expect(sql).not.toContain("insert into public.ledger_entries");
  });

  it("is read-only to authenticated staff and leaves customer/crew access fail-closed", () => {
    for (const table of commercialTables) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
      expect(sql).toContain(`revoke all on table public.${table} from anon, authenticated`);
      expect(sql).toContain(`grant select on table public.${table} to authenticated`);
      expect(sql).toContain(`grant all on table public.${table} to service_role`);
    }
    expect(sql).toContain("array['OWNER','DISPATCHER']::public.membership_role[]");
    expect(sql).not.toContain("commercial_organizations_customer_select");
    expect(sql).not.toContain("commercial_sites_customer_select");
    expect(sql).not.toContain("for all to authenticated");
  });
});
