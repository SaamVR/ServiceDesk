import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/0054_v2_multibranch_resources.sql"),
  "utf8",
);

describe("V2 multi-branch resources migration", () => {
  it("models branch-scoped service zones, provider bindings and price-book selection", () => {
    expect(sql).toContain("create table if not exists public.branch_service_zones");
    expect(sql).toContain("create table if not exists public.branch_provider_bindings");
    expect(sql).toContain("create table if not exists public.branch_price_books");
    expect(sql).toContain("references public.workspace_branches(workspace_id, id)");
    expect(sql).toContain("references public.rate_cards(workspace_id, id)");
  });

  it("stores only opaque provider resource references and no provider secrets", () => {
    expect(sql).toContain("resource_ref text not null");
    expect(sql).toContain("resource_ref !~* '^(https?://|data:)'");
    expect(sql).not.toMatch(/access_token/i);
    expect(sql).not.toMatch(/refresh_token/i);
    expect(sql).not.toMatch(/api_key/i);
    expect(sql).not.toMatch(/client_secret/i);
  });

  it("keeps provider binding rows hidden from direct authenticated reads", () => {
    expect(sql).toContain("revoke all on table public.branch_provider_bindings from public, anon, authenticated");
    expect(sql).not.toContain("grant select on table public.branch_provider_bindings to authenticated");
    expect(sql).not.toContain("create policy branch_provider_bindings");
  });

  it("requires branch-access owner authority for resource mutation", () => {
    expect(sql).toContain("servicedesk_upsert_branch_service_zone");
    expect(sql).toContain("servicedesk_upsert_branch_provider_binding");
    expect(sql).toContain("servicedesk_set_branch_price_book");
    expect(sql).toContain("array['OWNER']::public.membership_role[]");
    expect(sql).toContain("servicedesk_actor_has_branch_access");
    expect(sql).toContain("servicedesk_actor_is_workspace_owner");
    expect(sql).toContain("v_role <> 'OWNER'");
  });

  it("rejects crew/provider bindings that point across branches", () => {
    expect(sql).toContain("BRANCH_CREW_MISMATCH");
    expect(sql).toContain("c.branch_id = v_branch");
  });

  it("returns provider readiness without returning resource refs", () => {
    const start = sql.indexOf("create or replace function public.servicedesk_read_branch_resource_summary");
    const end = sql.indexOf("revoke all on function public.servicedesk_upsert_branch_service_zone", start);
    const readFn = sql.slice(start, end);
    expect(readFn).toContain("'providerReadiness'");
    expect(readFn).toContain("'verified', p.verified_at is not null");
    expect(readFn).not.toContain("'resourceRef'");
    expect(readFn).not.toContain("'resource_ref'");
  });

  it("uses native branch timezone/currency in the resource summary", () => {
    expect(sql).toContain("'timezone', v_branch_row.timezone");
    expect(sql).toContain("'currency', v_branch_row.currency");
    expect(sql).toContain("'rateVersion', rc.version");
  });

  it("provides owner HQ branch comparison in each branch timezone and native currency", () => {
    expect(sql).toContain("servicedesk_read_branch_comparison_report");
    expect(sql).toContain("v_role <> 'OWNER'");
    expect(sql).toContain("array['OWNER']::public.membership_role[]");
    expect(sql).toContain("at time zone b.timezone");
    expect(sql).toContain("'currency', b.currency");
    expect(sql).toContain("i.currency = b.currency");
    expect(sql).toContain("'currencyMismatchCount'");
    expect(sql).toContain("Cross-currency totals are not converted or combined without an explicit FX source.");
    expect(sql).toContain("grant execute on function public.servicedesk_read_branch_comparison_report(jsonb) to service_role");
  });

  it("bounds HQ comparison to a finite date window", () => {
    expect(sql).toContain("(v_to_date - v_from_date) > 366");
    expect(sql).toContain("BRANCH_REPORT_INPUT_INVALID");
  });

});
