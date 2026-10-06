import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/0023_v2_team_invitation_lifecycle.sql"),
  "utf8",
);

function occurrences(value: string) {
  return sql.split(value).length - 1;
}

describe("V2 team invitation lifecycle migration", () => {
  it("defines each lifecycle function exactly once", () => {
    for (const fn of [
      "servicedesk_create_team_invitation",
      "servicedesk_revoke_team_invitation",
      "servicedesk_read_team_invitation",
      "servicedesk_accept_team_invitation",
      "servicedesk_read_owner_settings_snapshot",
    ]) {
      expect(occurrences(`create or replace function public.${fn}`)).toBe(1);
    }
    expect(sql).not.toContain("as $\n");
  });

  it("stores only token hashes and keeps lifecycle RPCs service-role only", () => {
    expect(sql).toContain("Only SHA-256 hex hashes are stored");
    expect(sql).toContain("v_token_hash !~ '^[0-9a-f]{64}$'");
    expect(sql).toContain("token_hash = v_token_hash");
    expect(sql).not.toContain("'token', v_");

    for (const fn of [
      "servicedesk_create_team_invitation",
      "servicedesk_revoke_team_invitation",
      "servicedesk_read_team_invitation",
      "servicedesk_accept_team_invitation",
    ]) {
      expect(sql).toContain(`revoke execute on function public.${fn}(jsonb) from public, anon, authenticated;`);
      expect(sql).toContain(`grant execute on function public.${fn}(jsonb) to service_role;`);
    }
  });

  it("revalidates owner authority for issue/revoke and account email for acceptance", () => {
    expect(occurrences("OWNER_SCOPE_REQUIRED")).toBe(2);
    expect(sql).toContain("and role = 'OWNER'");
    expect(sql).toContain("lower(v_invitation.email::text) <> v_user_email");
    expect(sql).toContain("email_confirmed_at");
    expect(sql).toContain("INVITATION_EMAIL_UNVERIFIED");
    expect(sql).toContain("INVITATION_EXPIRED");
    expect(sql).toContain("INVITATION_REVOKED");
  });

  it("activates membership only from the persisted invitation role and audits acceptance", () => {
    expect(sql).toContain("v_invitation.workspace_id, v_actor_user, v_invitation.role, 'ACTIVE'");
    expect(sql).toContain("on conflict (workspace_id, user_id) do update");
    expect(sql).toContain("'TEAM_INVITATION_ACCEPTED'");
    expect(sql).toContain("'TEAM_INVITATION_ISSUED'");
    expect(sql).toContain("'TEAM_INVITATION_REVOKED'");
  });

  it("extends owner settings with delivery metadata but excludes token material", () => {
    const ownerSnapshot = sql.slice(sql.indexOf("create or replace function public.servicedesk_read_owner_settings_snapshot"));
    expect(ownerSnapshot).toContain("'email', i.email");
    expect(ownerSnapshot).toContain("'expiresAt', i.expires_at");
    expect(ownerSnapshot).not.toContain("token_hash");
  });
});
