import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

const script = join(dirname(fileURLToPath(import.meta.url)), "v4-protected-qa-preflight.mjs");
const common = {
  SERVICEDESK_QA_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_testing_dummy_not_real_0123456789",
};
const ownerA = {
  SERVICEDESK_QA_OWNER_A_EMAIL: "first@example.test",
  SERVICEDESK_QA_OWNER_A_PASSWORD: "fictional-owner-a-12345",
  SERVICEDESK_QA_OWNER_A_WORKSPACE: "qa-one",
};
const ownerB = {
  SERVICEDESK_QA_OWNER_B_EMAIL: "second@example.test",
  SERVICEDESK_QA_OWNER_B_PASSWORD: "fictional-owner-b-12345",
  SERVICEDESK_QA_OWNER_B_WORKSPACE: "qa-two",
};
function run(profile, attrs = {}) {
  const env = { PATH: process.env.PATH || "/usr/bin:/bin", ...common, ...attrs };
  const result = spawnSync(process.execPath, [script, profile], { env, encoding: "utf8", timeout: 3000 });
  return { code: result.status, output: result.stdout + result.stderr };
}

describe("private authenticated QA preflight (synthetic/local, no provider)", () => {
  it("requires explicitly configured QA identity without exposing values", () => {
    const p = run("studio-owner");
    assert.notEqual(p.code, 0);
    assert.match(p.output, /MISSING_SERVICEDESK_QA_TEST_EMAIL/);
    assert.match(p.output, /MISSING_SERVICEDESK_QA_TEST_PASSWORD/);
  });

  it("accepts syntactically valid synthetic owner setup without claiming real auth proof", () => {
    const result = run("two-owner-rls", { ...ownerA, ...ownerB });
    assert.equal(result.code, 0);
    assert.match(result.output, /QA_PREFLIGHT_CONFIG_READY:two-owner-rls/);
    assert.match(result.output, /NOT YET PROVEN/);
    assert.doesNotMatch(result.output, /fictional-owner|first@example|second@example/);
  });

  it("blocks bad publishable key and invalid slug before network operations", () => {
    const result = run("two-owner-rls", {
      ...ownerA, ...ownerB, SERVICEDESK_QA_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_",
      SERVICEDESK_QA_OWNER_A_WORKSPACE: "INVALID SPACE",
    });
    assert.notEqual(result.code, 0);
    assert.match(result.output, /INVALID_SERVICEDESK_QA_SUPABASE_PUBLISHABLE_KEY/);
    assert.match(result.output, /INVALID_SERVICEDESK_QA_OWNER_A_WORKSPACE/);
  });

  it("rejects malformed address, overlong workspace and newline password without leakage", () => {
    const secret = "fictional-secret\nunsafe-value";
    const result = run("two-owner-rls", {
      ...ownerA, ...ownerB,
      SERVICEDESK_QA_OWNER_A_EMAIL: "invalid-mail-address",
      SERVICEDESK_QA_OWNER_B_PASSWORD: secret,
      SERVICEDESK_QA_OWNER_B_WORKSPACE: "q".repeat(41),
    });
    assert.notEqual(result.code, 0);
    for (const key of [
      "SERVICEDESK_QA_OWNER_A_EMAIL",
      "SERVICEDESK_QA_OWNER_B_PASSWORD",
      "SERVICEDESK_QA_OWNER_B_WORKSPACE",
    ]) assert.match(result.output, new RegExp("INVALID_" + key));
    assert.doesNotMatch(result.output, /unsafe-value|fictional-secret/);
  });

  it("does not accept owner identities that differ only by email case", () => {
    const result = run("two-owner-rls", { ...ownerA, ...ownerB,
      SERVICEDESK_QA_OWNER_B_EMAIL: "FIRST@EXAMPLE.TEST" });
    assert.notEqual(result.code, 0);
    assert.match(result.output, /DISTINCT_QA_OWNERS_AND_TENANTS_REQUIRED/);
  });

  it("accepts a normal owner email and password containing r/n/u characters", () => {
    const result = run("two-owner-rls", {
      ...ownerA, ...ownerB,
      SERVICEDESK_QA_OWNER_A_EMAIL: "owner.one@example.test",
      SERVICEDESK_QA_OWNER_A_PASSWORD: "Runner2026Passphrase",
    });
    assert.equal(result.code, 0);
    assert.match(result.output, /QA_PREFLIGHT_CONFIG_READY:two-owner-rls/);
  });

  it("rejects carriage return and null byte in owner password without echoing values", () => {
    for (const secret of ["safe-prefix\runsafe-value", "safe-prefix\u0000unsafe-value"]) {
      const result = run("two-owner-rls", {
        ...ownerA, ...ownerB, SERVICEDESK_QA_OWNER_A_PASSWORD: secret,
      });
      assert.notEqual(result.code, 0);
      assert.match(result.output, /INVALID_SERVICEDESK_QA_OWNER_A_PASSWORD/);
      assert.doesNotMatch(result.output, /unsafe-value|safe-prefix/);
    }
  });

  it("never accepts privileged Supabase credentials in public-key preflight", () => {
    const result = run("two-owner-rls", {
      ...ownerA, ...ownerB, SUPABASE_SERVICE_ROLE_KEY: "never-log-me-service-role",
    });
    assert.notEqual(result.code, 0);
    assert.match(result.output, /QA_PREFLIGHT_FORBIDDEN_PRIVILEGED_SUPABASE_KEY/);
    assert.doesNotMatch(result.output, /never-log-me/);
  });
});
