import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
const read = (p: string) => readFileSync(join(process.cwd(),p),"utf8");
const file="supabase/migrations/0065_v4_default_branch_membership_authority.sql";
const sql=read(file);
const reviewed=read("docs/engineering/security/servicedesk-default-branch-guard-candidate.sql");
const strip=(s:string)=>s.replace(/^--[^\n]*(?:\n|$)/gm,"").trim();

describe("0065 reviewed authenticated default branch authority release candidate",()=>{
  it("matches the independently PG17-tested reviewed function and grants",()=>{
    expect(strip(sql)).toBe(strip(reviewed));
    expect(sql).toContain("create or replace function public.servicedesk_default_branch(target_workspace uuid)");
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = ''");
  });
  it("authorizes by an actual active membership for this workspace, not a caller claim",()=>{
    expect(sql).toContain("m.workspace_id = target_workspace");
    expect(sql).toContain("m.user_id = auth.uid()");
    expect(sql).toContain("m.status = 'ACTIVE'");
    expect(sql).toContain("current_setting('role', true) = 'service_role'");
    expect(sql).toContain("auth.role() = 'service_role'");
    expect(sql).not.toMatch(/\b(?:drop\s+(?:table|schema|function)|delete\s+from|update\s+public\.|insert\s+into)\b/i);
  });
  it("preserves legitimate authenticated triggers while denying anonymous direct RPC",()=>{
    expect(sql).toContain("revoke all on function public.servicedesk_default_branch(uuid)");
    expect(sql).toContain("from public, anon");
    expect(sql).toContain("to authenticated, service_role");
    expect(sql).toContain("where b.workspace_id = target_workspace");
    expect(sql).toContain("b.is_default");
    expect(sql).toContain("b.active");
  });
  it("uses the release SQL for the real disposable two-owner PG17 auth and trigger test",()=>{
    const workflow=read(".github/workflows/v4-seven-table-branch-guard-pg17-rc.yml");
    expect(workflow).toContain("-f "+file);
    expect(workflow).toContain("tests/sql/v4-branch-trigger-pg17-authz-acceptance.sql");
    expect(workflow).toContain("tests/db/v4-default-branch-security-migration.test.ts");
    expect(workflow).not.toContain("psql -v ON_ERROR_STOP=1 -f docs/engineering/security/servicedesk-default-branch-guard-candidate.sql");
  });
});
