import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source=(path:string)=>readFileSync(join(process.cwd(),path),"utf8");
describe("R49 SONIC unattended exact-head CI controller",()=>{
 it("executes its 5 Node-native adversarial tests in the full V4 RC",()=>{
  const output=execFileSync(process.execPath,
   ["--test",join(process.cwd(),"scripts/release/v4-sonic-exact-head-guardian.test.mjs")],
   {cwd:process.cwd(),encoding:"utf8",timeout:15000,env:{NODE_ENV:"test"}});
  expect(output).toContain("# pass 5");
  expect(output).toContain("# fail 0");
 });
 it("runs only on canonical development push and uses read-only GitHub Actions permissions",()=>{
  const flow=source(".github/workflows/v4-sonic-exact-head-guardian.yml");
  expect(flow).toContain("feat/servicedesk-v4-reconciled-qa-shell-20261012");
  expect(flow).toContain("actions: read");
  expect(flow).toContain("contents: read");
  expect(flow).toContain("cancel-in-progress: true");
  expect(flow).not.toContain("issues: write");
  expect(flow).not.toContain("deploy");
  expect(flow).not.toContain("apply_migration");
  expect(flow).not.toContain("service_role");
 });
 it("never treats a model flag or source success as real staged merchant/provider acceptance",()=>{
  const script=source("scripts/release/v4-sonic-exact-head-guardian.mjs");
  expect(script).toContain("EXACT_HEAD_SOURCE_PG17_PASS");
  expect(script).toContain("GATES_TIMEOUT");
  expect(script).toContain("STALE_BRANCH_HEAD");
  expect(script).toContain("GATES_FAILED");
  expect(script).toContain("head_sha===sha");
  expect(script).toContain("head_branch===branch");
  expect(script).toContain("TWO matching exact commit");
  expect(script).not.toContain("customer_message");
  expect(script).not.toContain("execute_sql");
 });
});
