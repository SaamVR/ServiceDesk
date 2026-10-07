import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/0054_v2_multibranch_management.sql"),
  "utf8",
);

describe("V2 multi-branch management", () => {
  it("keeps branch creation/update owner-only and validates timezone/currency", () => {
    expect(sql).toContain("servicedesk_create_workspace_branch");
    expect(sql).toContain("servicedesk_update_workspace_branch");
    expect(sql).toContain("v_actor_role <> 'OWNER'");
    expect(sql).toContain("servicedesk_require_staff");
    expect(sql).toContain("v_currency !~ '^[A-Z]{3}$'");
    expect(sql).toContain("at time zone v_timezone");
    expect(sql).toContain("DEFAULT_BRANCH_CANNOT_DEACTIVATE");
  });

  it("treats owners as global and branch-assigns only non-owner staff", () => {
    expect(sql).toContain("servicedesk_set_branch_membership");
    expect(sql).toContain("if v_target_role = 'OWNER' then");
    expect(sql).toContain("'ownerGlobalAccess', true");
    expect(sql).toContain("insert into public.branch_memberships");
  });

  it("returns only authorized branch rows for non-owner staff", () => {
    expect(sql).toContain("servicedesk_read_branch_access_snapshot");
    expect(sql).toContain("v_actor_role = 'OWNER'");
    expect(sql).toContain("bm.user_id = v_actor_user");
    expect(sql).toContain("bm.active");
  });

  it("keeps every management RPC service-role-only", () => {
    for (const fn of [
      "servicedesk_create_workspace_branch",
      "servicedesk_update_workspace_branch",
      "servicedesk_set_branch_membership",
      "servicedesk_read_branch_access_snapshot",
    ]) {
      expect(sql).toContain(`revoke all on function public.${fn}(jsonb) from public, anon, authenticated`);
      expect(sql).toContain(`grant execute on function public.${fn}(jsonb) to service_role`);
    }
  });
});
