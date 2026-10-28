import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
const source=readFileSync("scripts/release/v4-p02-two-owner-readonly-acceptance.mjs","utf8");
const regression=readFileSync("scripts/release/tests/v4-p02-mid-audit-authority-revocation.test.mjs","utf8");

describe("P02 independent critic: latest read-only authority before audit PASS",()=>{
 it("requires a fresh saved ACTIVE owner membership and same default branch ID after RPC",()=>{
  const finalRead=source.indexOf('const finalMembership = await scoped("memberships", owner.expectedWorkspace)');
  const finalBranch=source.indexOf('const finalDefault = await scoped("workspace_branches", owner.expectedWorkspace)');
  const foreignRpc=source.indexOf('if (foreignBranch !== null)');
  const passed=source.indexOf('checked.push({ owner: owner.tag');
  expect(foreignRpc).toBeGreaterThan(0);
  expect(finalRead).toBeGreaterThan(foreignRpc);
  expect(finalBranch).toBeGreaterThan(finalRead);
  expect(passed).toBeGreaterThan(finalBranch);
  expect(source).toContain('finalDefault[0].id !== ownDefaults[0].id');
  expect(source).toContain('finalMembership.length !== 1');
  expect(source).toContain('OWNER_AUTHORITY_CHANGED_DURING_AUDIT');
  const deferred=source.indexOf('for (const recheck of finalAuthorityReadbacks) await recheck();');
  expect(deferred).toBeGreaterThan(passed);
  expect(regression).toContain('if(owner==="B")secondOwnerStarted');
 });
 it("probes the actual foreign owner's saved membership as an RLS witness",()=>{
  expect(source).toContain('user_id: "eq." + membershipSubject');
  expect(source).toContain('row.user_id !== membershipSubject');
  expect(source).toContain('foreign.expectedRequest, foreign.subject');
  const readbackTests=readFileSync("scripts/release/tests/v4-p02-two-owner-readonly-acceptance.test.mjs","utf8");
  const authorityTests=readFileSync("scripts/release/tests/v4-p02-two-owner-authorization-proof.test.mjs","utf8");
  expect(readbackTests).toContain("leakForeignMembership: true");
  expect(readbackTests).toContain("FOREIGN_TENANT_DATA_EXPOSED_MEMBERSHIPS");
  expect(authorityTests).toContain("foreign-membership-visible");
  expect(authorityTests).toContain("FOREIGN_TENANT_DATA_EXPOSED_MEMBERSHIPS");
 });
 it("does not claim validity after the bearer JWT expires mid-proof",()=>{
  expect(source).toContain("const finalClaims = jwtClaims(owner.token)");
  expect(source).toContain('finalClaims.exp * 1000 <= Date.now()');
  expect(source).toContain("OWNER_SESSION_EXPIRED_DURING_AUDIT");
  expect(regression).toContain('mid-audit');
  expect(regression).toContain('branch-changed');
  expect(regression).toContain('membership-revoked');
 });
 it("retains exact approved Supabase origin and only known read-only HTTP operations",()=>{
  expect(source).toContain('PROJECT_REF = "cpmmgivhlkfbiwzhlcey"');
  expect(source).toContain("if (url.origin !== ORIGIN)");
  expect(source).toContain('method: "POST", body: { target_workspace: id }');
  expect(source).toContain('method: options.method ?? "GET"');
  expect(source).not.toMatch(/process\.env\.(?:SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY)/);
  expect(source).not.toMatch(/\b(?:PATCH|PUT|DELETE)\b/);
 });
 it("retains owner/workspace uniqueness and hides auth tokens from proof payload",()=>{
  expect(source).toContain("entries[0].subject === entries[1].subject");
  expect(source).toContain("entries[0].expectedWorkspace === entries[1].expectedWorkspace");
  expect(source).toContain("entries[0].expectedRequest === entries[1].expectedRequest");
  expect(source).toContain('id: "eq." + requestId');
  expect(source).toContain("EXPECTED_OWNER_REQUEST_FIXTURE_MISSING");
  const requestTests=readFileSync("scripts/release/tests/v4-p02-two-owner-readonly-acceptance.test.mjs","utf8");
  expect(requestTests).toContain("rejects empty request fixtures rather than declaring false-positive request isolation");
  expect(source).toContain('scope: "OWN_WORKSPACE_ALLOWED_FOREIGN_DENIED"');
  const reply=source.slice(source.indexOf('return { result: "PASS"'));
  expect(reply).not.toContain("owner.token");
  expect(reply).not.toContain("key, entries");
 });
 it("no real second owner means real P02 UAT remains explicitly BLOCKED",()=>{
  const doc=readFileSync("docs/delivery/sonic-p02-end-readback-source-checkpoint-20261026.md","utf8");
  expect(doc).toContain("| Distinct `ACTIVE` `OWNER` membership subjects | **1** |");
  expect(doc).toContain("BLOCKED_OWNER_AUTHORIZATION");
  expect(doc).toContain("NO LIVE TWO-OWNER ACCEPTANCE");
  expect(doc).toContain("NO DEPLOYMENT");
 });
});
