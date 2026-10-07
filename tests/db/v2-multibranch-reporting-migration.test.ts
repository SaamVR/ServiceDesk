import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/0055_v2_multibranch_reporting.sql"),
  "utf8",
);

describe("V2 multi-branch reporting", () => {
  it("requires branch access for dispatcher branch reports", () => {
    expect(sql).toContain("servicedesk_read_branch_reporting_snapshot");
    expect(sql).toContain("servicedesk_require_branch_staff");
    expect(sql).toContain("v_actor_role not in ('OWNER','DISPATCHER')");
    expect(sql).toContain("r.branch_id = p_branch");
    expect(sql).toContain("v.branch_id = p_branch");
  });

  it("links money through invoice -> quote -> request branch truth", () => {
    expect(sql).toContain("join public.invoices i");
    expect(sql).toContain("join public.quotes q");
    expect(sql).toContain("join public.requests r");
    expect(sql).toContain("r.branch_id = p_branch");
    expect(sql).toContain("le.direction = 'CREDIT'");
  });

  it("returns branch-local timezone metadata without changing stored timestamps", () => {
    expect(sql).toContain("'timezone', v_branch.timezone");
    expect(sql).toContain("'localFrom'");
    expect(sql).toContain("p_from at time zone v_branch.timezone");
    expect(sql).toContain("'localTo'");
  });

  it("withholds mixed-currency company totals instead of inventing FX conversion", () => {
    expect(sql).toContain("servicedesk_read_branch_comparison_snapshot");
    expect(sql).toContain("count(distinct b.currency)");
    expect(sql).toContain("if v_currency_count = 1 then");
    expect(sql).toContain("v_collected := null");
    expect(sql).toContain("'mixedCurrency', v_currency_count > 1");
    expect(sql).toContain("Company money totals are withheld until a verified FX conversion policy is configured.");
  });

  it("keeps company comparison owner-only and service-role-only", () => {
    expect(sql).toContain("v_actor_role <> 'OWNER'");
    expect(sql).toContain("servicedesk_require_staff");
    expect(sql).toContain("revoke all on function public.servicedesk_read_branch_reporting_snapshot(jsonb)");
    expect(sql).toContain("revoke all on function public.servicedesk_read_branch_comparison_snapshot(jsonb)");
    expect(sql).toContain("grant execute on function public.servicedesk_read_branch_reporting_snapshot(jsonb)");
    expect(sql).toContain("grant execute on function public.servicedesk_read_branch_comparison_snapshot(jsonb)");
  });
});
