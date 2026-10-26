import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const candidate = read("docs/engineering/security/p02-owner-registration-db-authorization-candidate.sql");
const baseline = read("supabase/migrations/0059_v3_verified_owner_workspace_bootstrap.sql");
const start = "create or replace function public.servicedesk_register_owner_workspace(";
const guardStart = "  -- P02 defense: signed-in email verification alone is NOT registration";
const guardEnd = "  if exists (select 1 from public.workspaces where slug = v_slug) then";

describe("P02 source-only database-side owner registration authorization", () => {
  it("is an uninstalled candidate, not an automatically applied migration", () => {
    expect(candidate).toContain("NOT A MIGRATION, NOT DEPLOYED");
    expect(candidate).toContain("BEFORE generating/applying a corrective migration");
    expect(candidate).toContain("create schema servicedesk_security");
  });

  it("defaults closed and enforces exact nonrevoked owner grants", () => {
    expect(candidate).toContain("check (mode in ('CLOSED', 'QA_ONLY', 'PUBLIC'))");
    expect(candidate).toContain("values(true,'CLOSED');");
    expect(candidate).toContain("g.user_id = v_actor");
    expect(candidate).toContain("g.revoked_at is null");
    expect(candidate).toContain("g.expires_at > pg_catalog.now()");
    expect(candidate).not.toContain("g.expires_at is null");
    expect(candidate).toContain("expires_at timestamptz not null");
    expect(candidate).not.toContain("create table if not exists servicedesk_security");
    expect(candidate).toContain("REGISTRATION_NOT_AUTHORIZED");
    // Comments in the original function mention user_metadata only to reject it.
    // Guard against executable privilege claims, not explanatory comments.
    expect(candidate).not.toMatch(/\braw_user_meta_data\b/);
    expect(candidate).not.toContain("auth.jwt()");
    expect(candidate).not.toContain("auth.jwt()");
  });

  it("blocks client access to both protected control tables", () => {
    for (const table of ["owner_registration_control", "owner_registration_grants"]) {
      expect(candidate).toContain("alter table servicedesk_security." + table + " enable row level security");
      expect(candidate).toContain("revoke all on table servicedesk_security." + table);
    }
    expect(candidate).toContain("revoke all on schema servicedesk_security from public, anon, authenticated");
    expect(candidate).toContain("grant execute on function public.servicedesk_register_owner_workspace");
  });

  it("retains the entire prior verified registration function except the authorization guard", () => {
    const oldStart = baseline.indexOf(start);
    const newStart = candidate.indexOf(start);
    expect(oldStart).toBeGreaterThanOrEqual(0);
    expect(newStart).toBeGreaterThanOrEqual(0);
    const oldFunction = baseline.slice(oldStart);
    const newFunction = candidate.slice(newStart);
    const a = newFunction.indexOf(guardStart);
    const b = newFunction.indexOf(guardEnd);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(b).toBeGreaterThan(a);
    expect(newFunction.slice(0, a) + newFunction.slice(b)).toBe(oldFunction);
    expect(a).toBeGreaterThan(newFunction.indexOf("if (v_existing_slug is not null)"));
  });

  it("provides a PostgreSQL 17 two-owner role/expiry/revocation test with no live providers", () => {
    const fixture = read("tests/sql/p02-owner-registration-db-authorization-pg17.sql");
    expect(fixture).toContain("\\i docs/engineering/security/p02-owner-registration-db-authorization-candidate.sql");
    expect(fixture).toContain("set local role authenticated");
    expect(fixture).toContain("P02_DISPOSABLE_PG17_REGISTRATION_DB_AUTHORIZATION_PASS");
    for (const value of ["CLOSED", "QA_ONLY", "PUBLIC", "expired", "revoked_at", "EMAIL_VERIFICATION_REQUIRED", "client_tamper", "kill_switch", "anon_rpc"]) {
      expect(fixture.toLowerCase()).toContain(value.toLowerCase());
    }
    const workflow = read(".github/workflows/p02-owner-registration-candidate-pg17.yml");
    expect(workflow).toContain("image: postgres:17");
    expect(workflow).toContain("tests/sql/p02-owner-registration-db-authorization-pg17.sql");
    expect(workflow).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });
});
