import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
describe("P02 source acceptance gate: Node two-owner adversarial suite is exercised in full RC",()=>{
 it("executes both isolated Node runner suites without external data or providers",()=>{
  const output=execFileSync(process.execPath,[
   "--test",
   "scripts/release/tests/v4-p02-two-owner-readonly-acceptance.test.mjs",
   "scripts/release/tests/v4-p02-two-owner-authorization-proof.test.mjs",
  ],{cwd:root,encoding:"utf8",timeout:30_000,
     env:{...process.env,NODE_ENV:"test",SD_P02_ACCEPTANCE_APPROVED:""}}); 
  expect(output).toContain("# fail 0");
  expect(output).toContain("not ok").toBe(false);
  expect(output).toContain("requires two scoped active owners");
  expect(output).toContain("fails closed rather than reporting two-owner acceptance");
 });
 it("preserves the README boundary that synthetic tests are not actual owner logins",()=>{
  const doc=readFileSync(join(root,
   "docs/delivery/sonic-gap/11-p02-owner-identity-and-default-branch-proof-20261026.md"),
  "utf8");
  expect(doc).toContain("CONTRACT_TESTED");
  expect(doc).toContain("CONFIGURATION_BLOCKED");
  expect(doc).toContain("two real, separately controlled fictional QA accounts");
  expect(doc).toContain("not a signature verification");
 });
});
