import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ownerRegistrationMode, ownerRegistrationEmailAllowed,
  ownerRegistrationPubliclyAvailable,
} from "../../src/features/auth/owner-registration-readiness";
const source = (path: string) => readFileSync(join(process.cwd(),path),"utf8");
const migration=source("supabase/migrations/0065_v4_default_branch_membership_authority.sql");
const audit=source("scripts/release/v4-p02-two-owner-readonly-acceptance.mjs");
const twoOwner=source("scripts/release/v4-default-branch-rpc-boundary.mjs");
const ownerEnv:NodeJS.ProcessEnv={
 NEXT_PUBLIC_SUPABASE_URL:"https://synthetic-project.supabase.co",
 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"sb_publishable_synthetic",
 SERVICEDESK_AUTH_REDIRECT_ORIGIN:"https://example.test",
 SERVICEDESK_OWNER_REGISTRATION_ENABLED:"false",
 SERVICEDESK_OWNER_REGISTRATION_QA_ENABLED:"true",
 SERVICEDESK_OWNER_REGISTRATION_QA_EMAILS:"owner-a@example.test,owner-b@example.test",
};

describe("SONIC P02 release blocker — source-only, never live tenant acceptance",()=>{
 it("keeps QA and public registration disabled unless exact server-side authority flag is granted",()=>{
  for(const state of [undefined,"","1","TRUE","True","false","approved"]){
    const env={...ownerEnv,SERVICEDESK_OWNER_REGISTRATION_TENANT_AUTHZ_APPROVED:state,
      SERVICEDESK_OWNER_REGISTRATION_ENABLED:"true"};
    expect(ownerRegistrationMode(env)).toBe("DISABLED");
    expect(ownerRegistrationPubliclyAvailable(env)).toBe(false);
    expect(ownerRegistrationEmailAllowed("owner-a@example.test",env)).toBe(false);
  }
 });
 it("limits approved QA mode to permitted fictional owner addresses and never markets as public",()=>{
  const env={...ownerEnv,SERVICEDESK_OWNER_REGISTRATION_TENANT_AUTHZ_APPROVED:"true"};
  expect(ownerRegistrationMode(env)).toBe("QA_ONLY");
  expect(ownerRegistrationPubliclyAvailable(env)).toBe(false);
  expect(ownerRegistrationEmailAllowed("OWNER-A@EXAMPLE.TEST",env)).toBe(true);
  expect(ownerRegistrationEmailAllowed("owner-b@example.test",env)).toBe(true);
  expect(ownerRegistrationEmailAllowed("foreign-owner@example.test",env)).toBe(false);
 });
 it("source migration 0065 binds default-branch definer to active membership and trustworthy service role",()=>{
  expect(migration).toContain("security definer");
  expect(migration).toContain("set search_path = ''");
  expect(migration).toContain("m.workspace_id = target_workspace");
  expect(migration).toContain("m.user_id = auth.uid()");
  expect(migration).toContain("m.status = 'ACTIVE'");
  expect(migration).toContain("auth.role() = 'service_role'");
  expect(migration).toContain("current_setting('role', true) = 'service_role'");
  expect(migration).toContain("b.is_default");
  expect(migration).toContain("b.active");
  expect(migration).toContain("revoke all on function public.servicedesk_default_branch(uuid)");
  expect(migration).toContain("from public, anon");
  expect(migration).toContain("to authenticated, service_role");
 });
 it("source release cannot silently auto-install 0065 by importing app or running CI",()=>{
  const pipeline=source(".github/workflows/v4-seven-table-branch-guard-pg17-rc.yml");
  expect(pipeline).toContain("tests/sql/v4-branch-trigger-pg17-authz-acceptance.sql");
  expect(pipeline).toContain("supabase/migrations/0065_v4_default_branch_membership_authority.sql");
  expect(migration).toContain("Do NOT apply to the connected Supabase project");
  expect(audit).toContain("SD_P02_ACCEPTANCE_APPROVED");
  expect(audit).toContain("READ_ONLY");
 });
 it("read-only acceptance uses owner JWTs, publishable key, pinned origin, and refuses redirects",()=>{
  for(const boundary of ["SD_P02_OWNER_A_JWT","SD_P02_OWNER_B_JWT",
    "SD_P02_OWNER_A_WORKSPACE_ID","SD_P02_OWNER_B_WORKSPACE_ID",
    "SD_P02_PUBLISHABLE_KEY","WRONG_SUPABASE_PROJECT_JWT",
    "OWNERS_AND_WORKSPACES_MUST_BE_DIFFERENT","FOREIGN_TENANT_DATA_EXPOSED_",
    "FOREIGN_DEFAULT_BRANCH_DISCLOSURE"])expect(audit).toContain(boundary);
  expect(audit).toContain('redirect: "error"');
  expect(audit).toContain('"GET"');
  expect(audit).toContain('"POST"');
  expect(audit).toContain("rpc/servicedesk_default_branch");
  expect(audit).not.toMatch(/\b(createUser|signUp|insert\s+into|drop\s+table)\b/);
 });
 it("a foreign null alone never constitutes valid cross-tenant proof",()=>{
  expect(twoOwner).toContain("DEFAULT_BRANCH_TWO_DISTINCT_OWNERS_REQUIRED");
  expect(twoOwner).toContain("DEFAULT_BRANCH_OWN_ROW_NOT_UNAMBIGUOUS");
  expect(twoOwner).toContain("DEFAULT_BRANCH_FOREIGN_RPC_EXPOSURE_OR_UNVERIFIED");
  expect(twoOwner).toContain("readAuthenticatedOwnerDefaultBranch");
  expect(twoOwner).toContain("aBranch === bBranch");
 });
});
