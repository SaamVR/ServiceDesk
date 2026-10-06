import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/0024_v2_commercial_portfolio_read.sql"),
  "utf8",
);

describe("V2 commercial portfolio read migration", () => {
  it("requires trusted staff scope and explicit feature activation", () => {
    expect(sql).toContain("public.servicedesk_require_staff(v_workspace, v_actor_user, v_actor_role)");
    expect(sql).toContain("feature_key = 'COMMERCIAL_OPERATIONS'");
    expect(sql).toContain("if not found or not v_feature.enabled");
    expect(sql).toContain("COMMERCIAL_FEATURE_DISABLED");
  });

  it("returns the complete portfolio graph without mutating business state", () => {
    for (const key of ["organizations", "contacts", "sites", "contracts", "contractVersions", "contractSites", "servicePlans", "exceptionCases"]) {
      expect(sql).toContain(`'${key}'`);
    }
    expect(sql).not.toContain("update public.");
    expect(sql).not.toContain("delete from public.");
    expect(sql).not.toContain("insert into public.");
  });

  it("is callable only through the trusted service-role boundary", () => {
    expect(sql).toContain("revoke all on function public.servicedesk_read_commercial_portfolio_snapshot(jsonb) from authenticated");
    expect(sql).toContain("grant execute on function public.servicedesk_read_commercial_portfolio_snapshot(jsonb) to service_role");
  });
});
