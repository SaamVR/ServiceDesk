import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/0060_v3_restrict_anonymous_branch_helpers.sql"),
  "utf8",
).toLowerCase();

describe("0060: anonymous SECURITY DEFINER branch RPC lockdown", () => {
  it("revokes execute from both PUBLIC and anon for exact RPC signatures", () => {
    expect(sql).toContain("revoke execute on function public.servicedesk_default_branch(uuid)");
    expect(sql).toContain("revoke execute on function public.servicedesk_has_branch_access(");
    expect(sql).toMatch(/uuid,\s*uuid,\s*public\.membership_role\[\]/);
    expect((sql.match(/from public, anon/g) ?? [])).toHaveLength(2);
  });
  it("retains authenticated RLS policy and internal service-role execution", () => {
    expect((sql.match(/to authenticated, service_role/g) ?? [])).toHaveLength(2);
    expect(sql).toContain("begin;");
    expect(sql).toContain("commit;");
  });
  it("does not replace definer functions, disable RLS or mutate customer records", () => {
    expect(sql).not.toMatch(/\b(drop|delete|truncate|update|insert)\s+(?:from\s+|into\s+)?public\./);
    expect(sql).not.toContain("disable row level security");
    expect(sql).not.toContain("create or replace function");
    expect(sql).not.toMatch(/grant execute[\s\S]*?to anon/);
  });
});
